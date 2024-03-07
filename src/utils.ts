import fs from "fs";
import { Page } from "puppeteer";
import { isInputFileSource, txnSource } from "..";
import {
  ADDRESS_TRUNC,
  ETHERSCAN_BY_ADDRESS,
  INPUT_TXT,
  OUTPUT_DIR,
  OUTPUT_FILE_NAME,
} from "./constants";

export const getFileTxns = (txns: string[]) => {
  if (!fs.existsSync(INPUT_TXT)) {
    console.error(`Create input source file first: touch ${INPUT_TXT}`);

    return txns;
  }

  const data = fs.readFileSync(INPUT_TXT, "utf8");
  // TODO: Validate each txn
  const txnLines = data.split("\n").filter(Boolean);

  txns.push(...txnLines);
};

export const getAllAddressTxns = async (txns: string[], page: Page) => {
  // If going through all txns, get all transactions from each page
  // Start at first page
  let currPageNum = 1;
  let totalPageNum = 1;

  // Get total number of pages at the first page
  // try {
  //   totalPageNum = await page.$$eval(
  //     `[aria-label="table navigation"] li.page-item`,
  //     (btns) => {
  //       const pageLabelText = btns[2]?.textContent?.split(" ") || "";
  //       const pageNumber = Number(pageLabelText[pageLabelText?.length - 1]);
  //       currPageNum = 2;

  //       return pageNumber;
  //     }
  //   );
  // } catch {
  //   console.info("Only one page");
  // }

  console.log(`Total pages: ${totalPageNum}`);

  while (currPageNum < totalPageNum + 1) {
    console.log(`On page ${currPageNum}`);

    await page.goto(`${ETHERSCAN_BY_ADDRESS}&p=${currPageNum}`);

    // Wait for the txns page to load and display the txns.
    // @ts-ignore
    const txnsList: string[] = await page.$$eval(
      ".hash-tag > .myFnExpandBox_searchVal",
      (rows) => rows.map((el) => el.textContent)
    );
    // Increment current page number
    currPageNum++;

    txns.push(...txnsList);
  }
  console.log(txns);
  return txns;
};

export const createCsvFile = (
  txnList: {
    date: string;
    "spent amt": string;
    description: string;
    "txn hash": string;
    "txn fee (eth)": number;
    "gas fee (eth)": number;
    "image file": string;
  }[]
) => {
  const fileName = isInputFileSource ? OUTPUT_FILE_NAME : ADDRESS_TRUNC;
  const headerRow = [
    "Date",
    "Spent Amount",
    "Business Purpose",
    "Transaction Hash",
    "Transaction Fee (ETH)",
    "Gas Fee (ETH)",
  ].join(", ");

  const rows = [headerRow];

  Object.values(txnList).map((value: any) => {
    const row = Object.values(value).join(", ");
    rows.push(row);
  });

  const allRows = rows.join("\n");

  fs.writeFile(
    `${OUTPUT_DIR}/${fileName}-reimbursements.csv`,
    allRows,
    "utf8",
    (err) => {
      if (err) {
        console.error(err);
      } else {
        console.log(
          `File created: ${fileName}-reimbursements.csv saved to '${OUTPUT_DIR}' directory`
        );
      }
    }
  );
};

export const createFailedTxnsFile = (txns: string[]) => {
  const failedTxns = `${OUTPUT_DIR}/failed-txns.txt`;
  fs.writeFile(failedTxns, txns.join("\n"), "utf8", (err) => {
    if (err) {
      throw err;
    }

    console.log(
      `File created: ${failedTxns} saved to '${OUTPUT_DIR}' directory`
    );
  });
};
