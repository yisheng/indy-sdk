# Developer Guide

- [x] 安装 Rust 环境
- [x] 编译 libindy
    1. `cd /path/to/indy-sdk/libindy/`
    2. `cargo build`
- [ ] 编译 libnullpay
    1. `cd /path/to/indy-sdk/libnullpay/`
    2. `cargo build`
- [ ] 编译 libvcx
    1. `cd /path/to/indy-sdk/vcx/libvcx/`
    2. `cargo build`
- [ ] 编译 dummy-cloud-agent
    1. `cd /path/to/indy-sdk/vcx/dummy-cloud-agent/`
    2. `cargo build`
- [ ] 运行 dummy-cloud-agent
    1. `cd /path/to/indy-sdk/vcx/dummy-cloud-agent/`
    2. `RUST_LOG=debug ./target/debug/indy-dummy-agent ./sample-config.json`
- [ ] 安装 Python3 环境
- [ ] 运行 Python 版 demo
    1. `cd /path/to/indy-sdk/vcx/wrappers/python3/demo/`
    2. `export PYTHONPATH=../`
    3. `rm -Rdf ~/.indy_client/wallet/*`
    3. `python3 ./faber.py`
    4. Copy the `invite details` JSON string
    5. Open a new terminal window and run `python3 ./alice.py`
    6. Paste the `invite details` JSON string
- [ ] [Optional] Run NodeJS wrappers' unit test
    1. `cd /path/to/indy-sdk/vcx/wrappers/node/`
    2. `npm install`
    3. `npm run test`
- [ ] Review iOS/Android wrappers
- [ ] Additional documentations
    - [Getting Started with Libvcx](docs/getting-started/getting-started.md)
    - [DKMS](https://github.com/hyperledger/indy-sdk/blob/master/doc/design/005-dkms/DKMS%20Design%20and%20Architecture%20V3.md)
    - [Cross-Domain Messaging](https://github.com/hyperledger/indy-hipe/tree/master/text/0022-cross-domain-messaging)
    - [DIDDoc Conventions](https://github.com/hyperledger/indy-hipe/tree/master/text/0023-diddoc-conventions)
    - [Messaging Protocol](https://github.com/hyperledger/indy-hipe/tree/928eb157e1672199f1a9e7405ecd1c0e7b6658be/text/connection-protocol)

![](https://raw.githubusercontent.com/yisheng/indy-sdk/master/doc/design/005-dkms/images/image_0.png)

![](https://raw.githubusercontent.com/hyperledger/indy-hipe/master/text/0022-cross-domain-messaging/domains.jpg)