import React from "react";
import PrimaryButton from "./base/PrimaryButton";
import { evaluate } from "mathjs";

export default function ValuationSpreadsheet({ data }) {

  const initialData = data;

  // REGEXES
  const cellReferenceRegex = /(?!-)(\$?[A-Z]{1,2}\$?\d+)|^[rc]$/gm;
  const cellColRegex = /[A-Za-z$]+/gm;
  const cellRowRegex = /\d+$/;
  const currencyRegex = /^\$[\d,]+(\.\d+)?\s*$/;

  const alphabets = [...Array(26).keys()].map((n) =>
    String.fromCharCode(65 + n)
  );

  // SPREADSHEET
  const width = initialData[0].length + 1;
  const height = initialData.length + 1;

  const spreadSheet = [];

  let spreadSheetContainer;

  class Cell {
    constructor(
      isHeader,
      disabled,
      data,
      row,
      column,
      rowName,
      columnName,
      active = false,
      formula = undefined,
      isCurrency = false
    ) {
      this.isHeader = isHeader;
      this.data = data;
      this.row = row;
      this.column = column;
      this.rowName = rowName;
      this.columnName = columnName;
      this.active = active;
      this.formula = formula;
      this.disabled = disabled || Boolean(formula);
      this.dependencies = new Set();
      this.element = undefined;
    }

    getCellRef() {
      return `${alphabets[this.column - 1] || "header"}${this.row}`;
    }

    updateValue() {
      if (this.formula) {
        const parseFormula = this.formula;
        const result = parseFormula.replace(cellReferenceRegex, (cellRef) => {
          const gr = getCellFromRef(cellRef).updateValue();
          return `${gr}`;
          // `${getCellFromRef(cellRef).updateValue()}`
        });
        this.data = evaluate(result);
        this.element.value = this.data;
      }
      return this.data;
    }

    updateDependencies() {
      this.dependencies.forEach((cell) => {
        cell.updateValue();
        cell.updateDependencies();
      });
    }
  }

  function drawSheet() {
    spreadSheetContainer.innerHTML = "";
    for (let i = 0; i < spreadSheet.length; i++) {
      const rowContainer = document.createElement("div");
      rowContainer.className = "cell-row flex ";

      for (let j = 0; j < spreadSheet[i].length; j++) {
        const cell = spreadSheet[i][j];
        rowContainer.append(createCellElem(cell));
      }
      spreadSheetContainer.append(rowContainer);
    }
  }

  function evalParsedFormula(parsedFormula) {
    const sliced = parsedFormula.substring(0, 4);
    if (sliced.includes("PMT")) {
      console.log(parsedFormula);
    } else {
      return evaluate(parsedFormula);
    }
  }

  function initSpreadsheet() {
    let formulaCells = [];
    for (let i = 0; i < height; i++) {
      let spreadSheetRow = [];
      for (let j = 0; j < width; j++) {
        let cellData = "";
        let isHeader = false;
        let disabled = false;
        let formula = undefined;
        let isCurrency = false;
        if (j === 0) {
          cellData = i;
          isHeader = true;
          disabled = true;
        }
        if (i === 0) {
          cellData = alphabets[j - 1] || "";
          isHeader = true;
          disabled = true;
        }
        if (cellData <= 0) {
          cellData = "";
        }
        if (!isHeader) cellData = initialData[i - 1][j - 1];
        if (cellData.length > 0 && ["=", "'"].includes(cellData[0])) {
          if (cellData[0] === "'") {
            formula = cellData.substring(2);
          } else {
            formula = cellData.substring(1);
          }
          cellData = "";
        }
        if (currencyRegex.test(cellData)) {
          isCurrency = true;
          cellData = cellData.replace("$", "");
        }
        const rowName = i;
        const columnName = alphabets[j - 1];
        const cell = new Cell(
          isHeader,
          disabled,
          cellData,
          i,
          j,
          rowName,
          columnName,
          false,
          formula,
          isCurrency
        );
        if (formula) {
          formulaCells.push(cell);
        }
        spreadSheetRow.push(cell);
      }
      spreadSheet.push(spreadSheetRow);
    }
    formulaCells.map((cellInstance) => {
      const parseFormula = cellInstance.formula;
      const result = parseFormula.replace(cellReferenceRegex, (cellRef) => {
        const otherCellInstance = getCellFromRef(cellRef);
        otherCellInstance.dependencies.add(cellInstance);
        return `${otherCellInstance.data || 0}`;
      });

      cellInstance.data = evalParsedFormula(result);
    });

    drawSheet();
  }

  React.useEffect(() => {
    // brainstorm js fix, feels dirty
    spreadSheetContainer = document.getElementById("spreadsheet-container");
    initSpreadsheet();
  }, []);

  function createCellElem(cell) {
    const cellElem = document.createElement("input");
    cellElem.className =
      "cell w-[70px] h-[40px] border-solid border-[1px] box-border border-slate-50 outline-none focus:border-2 focus:border-ctaBlue focus:bg-gray-100";
    cellElem.id = "cell_" + cell.row + cell.column;
    if (cellElem.id === "cell_55") {
      cellElem.formula = (elems) => {
        return elems[0] + elems[1];
      };
      cellElem.dependencies = [
        getElemFromRowCol(2, 2),
        getElemFromRowCol(2, 3),
      ];
    }
    cellElem.value = cell.data;
    cellElem.disabled = cell.disabled;

    if (cell.isHeader) {
      cellElem.classList.add("text-center");
    }
    if (cell.formula) {
      cellElem.classList.add("bg-gray-100");
    }
    cellElem.onfocus = () => handleCellFocus(cell);
    cellElem.onchange = (e) => handleCellOnChange(e.target.value, cell);
    cell.element = cellElem;

    return cellElem;
  }

  function handleCellFocus(cell) {
    const columnHeader = spreadSheet[0][cell.column];
    const rowHeader = spreadSheet[cell.row][0];
    const columnHeaderElem = getElemFromRowCol(
      columnHeader.row,
      columnHeader.column
    );
    clearHeaderActiveStates();
    const rowHeaderElem = getElemFromRowCol(rowHeader.row, rowHeader.column);
    columnHeaderElem.classList.add("bg-ctaBlue", "text-white");
    rowHeaderElem.classList.add("bg-ctaBlue", "text-white");
  }

  function handleCellOnChange(data, cell) {
    cell.data = data;
    cell.updateDependencies();
  }

  function clearHeaderActiveStates() {
    for (let i = 0; i < spreadSheet.length; i++) {
      for (let j = 0; j < spreadSheet[i].length; j++) {
        const cell = spreadSheet[i][j];
        if (cell.isHeader) {
          const cellElem = getElemFromRowCol(cell.row, cell.column);
          cellElem.classList.remove("bg-ctaBlue", "text-white");
        }
      }
    }
  }

  function getElemFromRowCol(row, col) {
    return document.getElementById("cell_" + row + col);
  }

  function getCellFromRowCol(row, col) {
    return spreadSheet[row][col];
  }

  function getCellFromRef(reference) {
    const rowMatch = reference.match(cellRowRegex);
    const colMatch = reference.match(cellColRegex);
    const row = parseInt(rowMatch[0]) - 1;
    const col = colMatch[0].replace("$", "");

    // TODO support columns with more than one letter
    return getCellFromRowCol(row, col.charCodeAt(0) - 65 + 1);
  }

  function onExportClicked() {
    let csv = "";
    for (let i = 0; i < spreadSheet.length; i++) {
      csv +=
        spreadSheet[i]
          .filter((item) => !item.isHeader)
          .map((item) => item.data)
          .join(",") + "\r\n";
    }
    const csvObj = new Blob([csv]);
    const csvUrl = URL.createObjectURL(csvObj);
    const downloadLink = document.createElement("a");
    downloadLink.href = csvUrl;
    downloadLink.download = "Exported Spreadsheet.csv";
    downloadLink.click();
    downloadLink.removeChild();
  }

  return (
    <div>
      <PrimaryButton
        id="export-btn"
        text="Export Spreadsheet"
        classNames="m-2 !bg-green-600"
        onClick={() => onExportClicked()}
      />
      <div id="spreadsheet-container"></div>
    </div>
  );
}
