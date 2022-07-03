# Etherscan Txn Reimbursement

Gas & Txn fee reimbursements made easy (for cornbase employees).

**Why?** I'm not going to manually copy & paste tiny amounts, track totals on a spreadsheet, while also collecting screenshots of each transaction page.

### Setup

Copy `.env.sample` to `.env` and update with your address

```bash
cp .env.sample .env
```

Install

```
yarn install
```

### Options

**(1) Get all transactions from an address**

Script will find all txns for an address, and visit each txn page to generate data & assets.

**(2) List transactions to generate data**

Create file `txns.txt` and list transaction hash on each line

```bash
touch txns.txt
```

### Start generating data & images

```
yarn start
```

Generates `<filename>-reimbursements.csv` file and screenshots to the `output/` directory.
