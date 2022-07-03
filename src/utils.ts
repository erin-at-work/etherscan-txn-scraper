import fs from "fs";
import { Page } from "puppeteer";
import { ETHERSCAN_BY_ADDRESS, INPUT_TXT } from "./constants";

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
  try {
    totalPageNum = await page.$$eval(
      `[aria-label="page navigation"] li.page-item`,
      (btns) => {
        const pageLabelText = btns[2]?.textContent?.split(" ") || "";
        const pageNumber = Number(pageLabelText[pageLabelText?.length - 1]);
        currPageNum = 2;

        return pageNumber;
      }
    );
  } catch {
    console.info("Only one page");
  }

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

  return txns;
};
