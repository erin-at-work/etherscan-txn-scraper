import * as dotenv from "dotenv";
dotenv.config();

export const ADDRESS_TRUNC = `${process.env.ADDRESS}`.substring(0, 8);

export const OUTPUT_DIR = "output";

export const ARTIFACTS_DIR = `${OUTPUT_DIR}/screenshots`;

export const OUTPUT_FILE_NAME = "file";

export const INPUT_TXT = "input/txns.txt";

export const ETHERSCAN_BY_ADDRESS = `https://etherscan.io/txs?a=${process.env.ADDRESS}`;

export const ETHERSCAN_BY_TXN = `https://etherscan.io/tx`;
