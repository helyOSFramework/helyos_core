FROM ubuntu:jammy-20240911.1

# ------------------- install prerequisites -------------------

RUN rm -R /var/lib/apt/lists/ && apt -o Acquire::https::No-Cache=True update && \
    apt-get clean && apt-get -y update  && \
    apt-get -y install apt-utils && \
    apt-get -y install \
                lsb-release    \
                dos2unix  \
                wget      \
                curl && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*


# ------------------- setup timezone -------------------

RUN echo 'Etc/UTC' > /etc/timezone && \
ln -s /usr/share/zoneinfo/Etc/UTC /etc/localtime && \
apt-get update && \
apt-get install -q -y --no-install-recommends tzdata && \
rm -rf /var/lib/apt/lists/*


# Install NodeJS
RUN apt-get -y update &&  curl -sL https://deb.nodesource.com/setup_20.x |  bash - && \
    apt-get -y install nodejs && \
    rm -rf /var/lib/apt/lists/*

# Uncomment the following lines to install PostgreSQL with the specified version 
# Be aware that some version binaries may not be available to all cpu platforms.
# RUN apt install curl ca-certificates
# RUN install -d /usr/share/postgresql-common/pgdg
# RUN curl -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc --fail https://www.postgresql.org/media/keys/ACCC4CF8.asc && \
#     'echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
  
RUN apt-get update && \
    apt-get install -y \
        postgresql-client-14 \
        postgresql-contrib-14 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*






