# Etherscan Txn Reimbursement Scraper

Gas & Txn fee reimbursements made easy (for cornbase employees).

Why? I'm not going to manually copy & paste tiny amounts, track totals on a spreadsheet, while also collecting screenshots of each transaction page.

Copy `.env.sample` to `.env` and update with your address

Install
```
yarn install
```

Start generating data & images
```
yarn start
```

Generates `<TRUNCATED_ADDRESS>-reimbursements.csv` file and screenshots to the 'output/' directory.