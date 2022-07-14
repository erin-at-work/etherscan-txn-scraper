# Etherscan Txn Reimbursement

Gas & Txn fee reimbursements made easy (for cornbase employees).

**Why did I make this?** After tediously copying & pasting tiny amounts, tracking totals on a spreadsheet, and collecting screenshots of each transaction page, I thought to myself there's gotta be an easier way...

### Setup

Install

```
yarn install
```

### Generate Artifacts + CSV file

Generates `<filename>-reimbursements.csv` file and screenshots to the `output/` directory.

**(1) Get all transactions from an address**

Script will find all txns for an address, and visit each txn page to generate data & assets.

⚠️ If you've a large number of transactions, running by address will go through _every_ one of them.

Copy `.env.sample` to `.env` and update with your address

```bash
cp .env.sample .env
```

```bash
yarn generate:address
```

**(2) Get list of transactions from text file**

Create file `txns.txt` and list transaction hash on each line

```bash
touch txns.txt
```

ie: 
```
0xf1ee25996fa4b4aa6c7e4b963b50s5fd8c0e1cf1c73cdbde668d7e87a5057719
0xbb7c55768be7cabad3dc8b387db975fb6e81b8dad0bbddbbbfc7651ebcb22890
0x9a29c887475b6bdab573a32a48668c6c639ecf7dd2047b1755eeec25cc7ed3cd
... and so on
```

```bash
yarn generate:file
```

![console](example.png)

### Clear files

**Clear artifacts**

```bash
yarn clear:artifacts
```

**Clear csv**

```bash
yarn clear:csv
```
