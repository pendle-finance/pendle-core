'use strict';

const {contract} = require('hardhat');
const {promisify} = require('util');
const {resolve} = require('path');
const fs = require('fs');

const EIP170 = 24576;
const CONTRACTS = `${__dirname}/../build/artifacts/contracts`;
const DOCS = `${__dirname}/../docs`;
const LIST = `${__dirname}/contractBytecodeSizeList.json`;
const REPORT = `${DOCS}/bytecodeSizeReport.json`;
const READDIR = promisify(fs.readdir);
const STAT = promisify(fs.stat);

async function generateReport() {
  let bytecodeSize;
  let contractData;
  let result = {};
  let file;
  let files = await getFiles(CONTRACTS);

  for (let i = 0; i < files.length; i++) {
    file = files[i];
    contractData = JSON.parse(fs.readFileSync(file));

    if (contractData.deployedBytecode !== undefined) {
      bytecodeSize = contractData.deployedBytecode.length / 2 - 1;

      if (bytecodeSize > 0) {
        file = file.replace(/^.*[\\\/]/, '');
        file = `${file.substring(0, file.length - 5)}.sol`;
        result[file] = bytecodeSize;
      }
    }
  }

  return result;
}

async function getFiles(dir) {
  const subdirs = await READDIR(dir);
  const files = await Promise.all(
    subdirs.map(async (subdir) => {
      const res = resolve(dir, subdir);
      return (await STAT(res)).isDirectory() ? getFiles(res) : res;
    })
  );

  return files.reduce((a, f) => a.concat(f), []);
}

async function readReport() {
  return JSON.parse(fs.readFileSync(LIST, 'utf8'));
}

async function writeReport(content) {
  if (!fs.existsSync(DOCS)) {
    fs.mkdirSync(DOCS, {recursive: true});
  }

  fs.writeFileSync(REPORT, JSON.stringify(content, null, '\t'), 'utf8');
}

async function main() {
  const compareReport = await readReport();
  const newReport = await generateReport();
  let currentSize;
  let newSize;
  let diff;
  let diffDict = {};
  let exceeds;

  await writeReport(newReport);

  for (let contract in newReport) {
    if (contract in compareReport) {
      currentSize = compareReport[contract];
      newSize = newReport[contract];
      diff = newSize - currentSize;

      diffDict[contract] = {
        current: currentSize,
        new: newSize,
        diff: diff,
        exceeds: diff > EIP170,
      };
    }
  }

  for (let contract in compareReport) {
    if (contract in compareReport && !(contract in diffDict)) {
      currentSize = compareReport[contract];
      newSize = newReport[contract];
      diff = newSize - currentSize;
      if (diff != 0) {
        diffDict[contract] = {
          current: currentSize,
          new: newSize,
          diff: diff,
          exceeds: diff > EIP170,
        };
      }
    }
  }

  console.log('CONTRACT BYTECODE SIZE CHANGES');
  console.table(diffDict);
}

main();
