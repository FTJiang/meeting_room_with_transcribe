#!/usr/bin/env bash

#update Linux OS
sudo yum update

#Install Node.js and npm
curl -sL https://rpm.nodesource.com/setup_4.x | sudo -E bash -
sudo yum -y install nodejs
npm install -g npm

cd ~/roomServer && sudo npm install