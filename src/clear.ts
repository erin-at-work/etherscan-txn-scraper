import fs from "fs";
import { ARTIFACTS_DIR, OUTPUT_DIR } from "./constants";

const clearDirectory = process.argv[2] === "csv" ? OUTPUT_DIR : ARTIFACTS_DIR;

fs.readdir(`${clearDirectory}/`, (error, filesInDirectory) => {
  if (error) throw error;

  for (let file of filesInDirectory) {
    const extension = file.split(".")[1];
    if (["png", "csv"].includes(extension)) {
      console.log(`File removed: ${file}`);
      fs.unlinkSync(`${clearDirectory}/` + file);
    }
  }
});
