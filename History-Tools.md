## EOS-HistoyTools

## 简介



History Tolls包括*fillter* and *wasm-ql*

- fillter：包括fill-rocksdb和fill-pg(PostgreSQL). The database fillers connect to the nodeos state-history plugin and populate(增加数据到) databases.
- wasm-ql: wasm-ql listens on an http port and answers the following: binary data/JSON query

~~~
wasm-ql
+----------+    +------------+    +---------------+       +-------------------+
| database |    | database   |    | wasm-ql       |       | web browser       |
| filler   |    |            |    | ------------- |       | ---------------   |
|          | => | PostgreSQL | => | Server WASM A |  <=>  | Client WASM A     |
|          |    |     or     |    | Server WASM B |  <=>  | Client WASM B     |
|          |    |   RocksDB  |    | ...           |       |                   |
|          |    |            |    | Legacy WASM   |  <=>  | js using /v1/ RPC |
+----------+    +------------+    +---------------+       +-------------------+
~~~



## 安装PostgreSQL

### For CentOS

~~~
yum install postgresql-server.x86_64
# 初始化数据库
postgresql-setup initdb
# 开机自动启动
systemctl enable postgresql.service
# 启动服务
systemctl start postgresql.service

# 把配置文件中的认证METHOD的ident修改为trust，可以实现用账户和密码来访问数据库
vi /var/lib/pgsql/data/pg_hba.conf
-># IPv4 local connections:
->host    all             all             127.0.0.1/32            trust
service postgresql restart
~~~

### For Ubuntu

~~~
apt-get update
apt-get install postgresql
#Creating new cluster 9.5/main ...
#  config /etc/postgresql/9.5/main
#  data   /var/lib/postgresql/9.5/main
#  locale en_US.UTF-8
#  socket /var/run/postgresql
#  port   5432
#vim /etc/postgresql/9.5/main/postgresql.conf
~~~

### *<font color=red>创建role/db和索引</font>*

~~~
## 
sudo -u postgres psql
postgres=#\password       # 更改密码hellopw
postgres=#create user eos with password '123456';
postgres=#create database chain owner eos;
postgres=#grant all privileges on database chain to eos;

# 注意:fill-pg sets up a bare database without indexes and query functions. After fill-pg is caught up to the chain, stop it then run init.sql in this repository's source directory.
# 创建索引（history-tools镜像中）：/root/history-tools/src/init.sql
# apt-get install postgresql-client
psql -f init.sql
psql -U eos -d chain -h 127.0.0.1 -p 5432 -f init.sql

~~~

### 常用PostgreSQL命令

~~~
psql -U eos -d chain -h 127.0.0.1 -p 5432
chain=> \du # 查看用户列表
chain=> \l # 查看db列表
chain=> select * from pg_tables where tableowner='eos'; # 查看各db中的表
chain=> \d chain.block_info # 查询表结构
chain=> \d chain.transaction_trace
chain=> select * from chain.block_info; # 查询表记录
~~~



## Prepare Pre-Dockers

### EOS2.1.x

~~~
# EOS
#docker pull eosio/eosio
docker pull eosio/eosio:release_2.1.x
#docker pull eosio/eosio:develop
# NOTE:开启目录权限和docker挂载权限，否则docker-compose启动eos会报错"Failed to read DB header"
chmod a+rwx /data1/eosio-data
chmod a+rw /var/run/docker.sock 
# docker-compose启动eos(略)
~~~

### PostgreSQL(仅实验用)

注：实际运行时建议安装在宿主机上

~~~
# PostgreSQL(仅实验用)
docker pull postgres:9.6.21-alpine
# docker run --net=host --rm -it eosio/eosio:release_2.1.x
# To specify POSTGRES_PASSWORD to a non-empty value for the superuser. For example, "-e POSTGRES_PASSWORD=password" on "docker run".
docker run -e POSTGRES_PASSWORD=123456 --net=host --rm postgres:9.6.21-alpine
docker exec -it focused_gates bash
>create user eos with password '123456';
>create database chain owner eos;
>grant all privileges on database chain to eos;
~~~



### Histroy Tools

~~~
# EOS/Histroy Tools
docker pull eosio/history-tools:c763c194d5275de6d10175a9fc02342ea57560d8
docker run --net=host --rm -it eosio/history-tools:c763c194d5275de6d10175a9fc02342ea57560d8
export PGUSER=eos
export PGPASSWORD=123456
export PGDATABASE=chain
export PGHOST=127.0.0.1
./fill-pg --fill-connect-to 127.0.0.1:8080 --fpg-create
./fill-pg --fill-connect-to 127.0.0.1:8080
~~~



### 检查HistoryTools运行

#### 检查建表情况

~~~
psql -U eos -d chain -h 127.0.0.1 -p 5432
chain->\du # 查看用户列表
chain->\l # 查看db列表
~~~

#### 测试History的ws端口

~~~
wget https://github.com/vi/websocat/releases/download/v1.6.0/websocat_arm-linux-static
mv websocat_amd64-linux-static websocat
./websocat ws://127.0.0.1:8080/
~~~



#### docker-compose.yml

~~~
version: '3'
services:
  history-tools:
    image: eosio/history-tools:c763c194d5275de6d10175a9fc02342ea57560d8
    container_name: history-tools
    environment:
      - PGUSER=eos
      - PGPASSWORD=123456
      - PGDATABASE=chain
      - PGHOST=127.0.0.1
    restart: always
    network_mode: host
    command:
      - /root/history-tools/build/fill-pg
# docker-compose up -d
# docker exec -it history-tools bash
~~~



## 参考资料

- https://github.com/EOSIO/history-tools/issues/103
- https://github.com/EOSIO/history-tools/blob/master/doc/database-fillers.md
- https://github.com/EOSIO/history-tools/blob/master/doc/wasm-ql.md
- 恢复全量/非全量state-history：https://github.com/EOSIO/history-tools/blob/master/doc/nodeos-state-history.md

## 其他参考

### 构建HistoryTools

~~~
# git clone https://github.com/EOSIO/history-tools.git
# NOTE: develop分支据说才可以
git clone -b develop https://github.com/EOSIO/history-tools.git
cd histroy-tools
git submodule update --init --recursive
# du -h --max-depth 0 ../history-tools
#nohup wget -c wget https://dl.bintray.com/boostorg/release/1.70.0/source/boost_1_70_0.tar.gz &
#nohup wget -c https://github.com/Kitware/CMake/releases/download/v3.14.5/cmake-3.14.5.tar.gz
#nohup wget -c https://github.com/EOSIO/eos/releases/download/v1.8.6/eosio_1.8.6-1-ubuntu-18.04_amd64.deb &
#nohup wget -c https://github.com/EOSIO/eosio.cdt/releases/download/v1.6.2/eosio.cdt_1.6.2-1-ubuntu-18.04_amd64.deb
#docker build -t eosio/history-tools:merlin -f ubuntu-18.04.dockerfile .
docker build -t zhigui/history-tools:1.0.0 -f ubuntu-18.04.dockerfile .

# 简易运行HistoryTools
# docker run --net=host --rm -it eosio/history-tools:merlin
docker run --net=host --rm -it zhigui/history-tools:1.0.0

export PGUSER=root
export PGPASSWORD=123456
export PGDATABASE=chain
export PGHOST=127.0.0.1
./fill-pg --fill-connect-to 127.0.0.1:8080 --fpg-create
./fill-pg --fill-connect-to 127.0.0.1:8080
#fill-pg using configuration file /root/.local/share/eosio/fill-pg/config/config.ini
#fill-pg data directory is /root/.local/share/eosio/fill-pg/data
~~~



### Build EOS 2.1.0 rc3 docker

Dockerfile：

~~~
FROM centos:7
MAINTAINER mafan@zhigui.com

USER root
WORKDIR /root
RUN yum install https://github.com/eosio/eos/releases/download/v2.1.0-rc3/eosio-2.1.0-rc3.el7.x86_64.rpm -y
RUN yum clean all

CMD ["nodeos"]
# docker build -t zhigui/eos:2.1.0rc3 .
~~~


