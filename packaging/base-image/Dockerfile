FROM ubuntu:focal

# ------------------- install prerequisites -------------------

RUN rm -R /var/lib/apt/lists/ && apt -o Acquire::https::No-Cache=True update && \
    apt-get clean && apt-get -y update  && \
    apt-get -y install apt-utils && \
    apt-get -y install \
    sudo                                       \
    lsb-release                                \
    bash-completion                            \
    git                                        \
    vim                                        \
    wget                                       \
    postgresql-client                          \
    curl

# ------------------- build essentials -------------------

RUN rm -R /var/lib/apt/lists/ &&  apt-get clean && apt-get -y update  && \
    apt-get -y install  \
    build-essential                            \
    ccache                                     \
    perl                                       \
    python


# ------------------- setup timezone -------------------

RUN echo 'Etc/UTC' > /etc/timezone && \
ln -s /usr/share/zoneinfo/Etc/UTC /etc/localtime && \
apt-get update && \
apt-get install -q -y --no-install-recommends tzdata && \
rm -rf /var/lib/apt/lists/*

# ------------------- install dos2unux -------------------

RUN apt-get update && apt-get install -y dos2unix


RUN apt-get -y update 
RUN curl -sL https://deb.nodesource.com/setup_18.x | sudo -E bash - && \
    apt-get -y install nodejs 
RUN apt-get -y install postgresql postgresql-contrib