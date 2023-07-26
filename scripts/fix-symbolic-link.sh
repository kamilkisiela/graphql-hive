if [[ $(uname -s) == CYGWIN* ]]; then
  del /f ./Cargo.lock
  mklink ./Cargo.lock ./configs/cargo.Cargo.lock
else
  echo Unix needs no fixes
fi
