const path = require('path');
const bindings : any = require(path.join(__dirname, '../../../native'));
import {BigInt, toLittleEndian} from "../common";
import util from 'util';
bindings.p2_eddsa_generate_key = util.promisify(bindings.p2_eddsa_generate_key);
bindings.p2_eddsa_sign = util.promisify(bindings.p2_eddsa_sign);

const SCALAR_BYTES_SIZE = 32;
const POINT_BYTES_SIZE = 32;

import {eddsa as EdDSA} from 'elliptic';
const CURVE = 'ed25519';
const ec = new EdDSA(CURVE);

interface KeyPair {
    public_key: Ed25519Point;
    expanded_private_key: ExpandedPrivateKey;
}

interface ExpandedPrivateKey {
    prefix: Ed25519Scalar;
    private_key: Ed25519Scalar;
}

interface KeyAgg {
    apk: Ed25519Point;
    hash: Ed25519Scalar;
}

export class Ed25519Party2Share {

    public constructor(
        private key_pair: KeyPair,
        private agg_pub_key: KeyAgg,
        private id: string) {
    }

    public getKeyPair(): KeyPair {
        return this.key_pair;
    }

    public getAggregatedPublicKey(): KeyAgg {
        return this.agg_pub_key;
    }

    public getId(): string {
        return this.id;
    }

    public getPublicKey(): EdDSA.Point {
        const apkBytes = this.agg_pub_key.apk.bytes_str.padStart(POINT_BYTES_SIZE * 2, '0');
        return ec.decodePoint(apkBytes);
    }

    // expects a plain JS array as returned from the Rust bindings
    public static fromPlain(plain: any): Ed25519Party2Share {
        return new Ed25519Party2Share(
            plain[0],
            plain[1],
            plain[2]
        );
    }
}

export class Ed25519Signature {
    constructor(public R: Ed25519Point, public s: Ed25519Scalar) { }

    public static fromPlain(plain: any): Ed25519Signature {
        return new Ed25519Signature(plain.R, plain.s);
    }

    public toBuffer(): Buffer {
        const RBuf = Buffer.from(this.R.bytes_str.padStart(POINT_BYTES_SIZE * 2, '0'), 'hex');
        const sBuf = Buffer.from(this.s.padStart(SCALAR_BYTES_SIZE * 2, '0'), 'hex');
        const sBufLE = toLittleEndian(sBuf);
        return Buffer.concat([RBuf, sBufLE], POINT_BYTES_SIZE + SCALAR_BYTES_SIZE);
    }
}

type Ed25519Scalar = BigInt;

interface Ed25519Point {
    bytes_str: BigInt;
}

export class Ed25519Party2 {

    private party1Endpoint: string;

    public constructor(party1Endpoint: string) {
        this.party1Endpoint = party1Endpoint;
    }

    public async generateKey(): Promise<Ed25519Party2Share> {
        const res = JSON.parse(await bindings.p2_eddsa_generate_key(this.party1Endpoint));
        return Ed25519Party2Share.fromPlain(res);
    }

    public async sign(msgHash: Buffer, share: Ed25519Party2Share): Promise<Ed25519Signature> {
        const res = JSON.parse(await bindings.p2_eddsa_sign(
            this.party1Endpoint,
            JSON.stringify(msgHash.toString('hex')),
            JSON.stringify(share.getKeyPair()),
            JSON.stringify(share.getAggregatedPublicKey()),
            share.getId()));

        return Ed25519Signature.fromPlain(res);
    }
}

