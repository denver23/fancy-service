#!/bin/bash

ROOT=$(cd `dirname $0` && pwd -P)
cd $ROOT

stop() {
    kill -9  `ps aux | fgrep "carfetch.sh" | fgrep -v "fgrep" | awk '{print $2}'`
}

start() {
   nohup sh carfetch.sh >> ../logs/fetch_`date +%Y-%m-%d`.log 2 &
}


if [ "x$1" = "xstop" ]; then
  stop

elif [ "x$1" = "xstart" ]; then
  start

elif [ "x$1" = "xrestart" ]; then
  stop
  start

elif [ "x$1" = "xclearlog" ]; then
   cd ../logs
   rm -f *`date --date "0 days ago" +"%Y-%m-%d"`.log
fi
