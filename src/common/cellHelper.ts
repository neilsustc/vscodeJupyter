import { Position, Range, Selection, TextDocument, window } from 'vscode';
import { Cell } from '../contracts';
import { JupyterCodeLensProvider } from '../editorIntegration/codeLensProvider';
import { EditorContextKey } from './EditorContext';
import { LanguageProviders } from './languageProvider';

export class CellHelper {
    constructor(private cellCodeLenses: JupyterCodeLensProvider) { }

    public getActiveCell(): Thenable<{ cell: Range, nextCell?: Range, previousCell?: Range }> {
        const activeEditor = window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve(null);
        }

        return this.cellCodeLenses.getCodeLenses(activeEditor.document, null).then(lenses => {
            if (lenses.length === 0) {
                return null;
            }
            let currentCellRange: Range;
            let nextCellRange: Range;
            let previousCellRange: Range;
            lenses.forEach((lens, index) => {
                if (lens.range.contains(activeEditor.selection.start)) {
                    currentCellRange = lens.range;
                    if (index < (lenses.length - 1)) {
                        nextCellRange = lenses[index + 1].range;
                    }
                    if (index > 0) {
                        previousCellRange = lenses[index - 1].range;
                    }
                }
            });
            if (!currentCellRange) {
                return null;
            }
            return { cell: currentCellRange, nextCell: nextCellRange, previousCell: previousCellRange };
        });
    }
    public goToPreviousCell(): Thenable<any> {
        const activeEditor = window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve();
        }
        return this.getActiveCell().then(cellInfo => {
            if (!cellInfo || !cellInfo.previousCell) {
                return;
            }
            return this.advanceToCell(activeEditor.document, cellInfo.previousCell);
        });
    }
    public goToNextCell(): Thenable<any> {
        const activeEditor = window.activeTextEditor;
        if (!activeEditor || !activeEditor.document) {
            return Promise.resolve();
        }
        return this.getActiveCell().then(cellInfo => {
            if (!cellInfo || !cellInfo.nextCell) {
                return;
            }
            return this.advanceToCell(activeEditor.document, cellInfo.nextCell);
        });
    }
    public advanceToCell(document: TextDocument, range: Range): Promise<any> {
        if (!range || !document) {
            return;
        }
        const textEditor = window.visibleTextEditors.find(editor => editor.document && editor.document.fileName === document.fileName);
        if (!textEditor) {
            return;
        }

        // Remember, we use comments to identify cells
        // Setting the cursor to the comment doesn't make sense
        // Quirk 1: Besides the document highlighter doesn't kick in (event' not fired), when you have placed the cursor on a comment
        // Quirk 2: If the first character starts with a %, then for some reason the highlighter doesn't kick in (event' not fired)
        let firstLineOfCellRange = Promise.resolve(range);
        if (range.start.line < range.end.line) {
            let rangeToSearchIn = new Range(new Position(range.start.line + 1, 0), range.end);
            let firstLine = LanguageProviders.getFirstLineOfExecutableCode(document.languageId, range, document, rangeToSearchIn);
            firstLineOfCellRange = firstLine.then(line => {
                return document.lineAt(line).range;
            });
        }

        firstLineOfCellRange.then(range => {
            textEditor.selections = [];
            textEditor.selection = new Selection(range.start, range.start);
            textEditor.revealRange(range);
            window.showTextDocument(textEditor.document);
        });
    }

    public static getCells(document: TextDocument): Cell[] {
        let language = document.languageId;
        let editorCtx = new EditorContextKey('jupyter.document.hasCodeCells');
        let cellIdentifier = LanguageProviders.cellIdentifier(language);
        if (!cellIdentifier || !(cellIdentifier instanceof RegExp)) {
            editorCtx.set(false);
            return [];
        }
        const cells: Cell[] = [];
        for (let index = 0; index < document.lineCount; index++) {
            const line = document.lineAt(index);
            // clear regex cache
            cellIdentifier.lastIndex = -1;
            if (cellIdentifier.test(line.text)) {
                const results = cellIdentifier.exec(line.text);
                if (cells.length > 0) {
                    const previousCell = cells[cells.length - 1];
                    previousCell.range = new Range(previousCell.range.start, document.lineAt(index - 1).range.end);
                }
                cells.push({
                    range: line.range,
                    title: results.length > 1 ? results[2].trim() : ''
                });
            }

        }

        if (cells.length >= 1) {
            const line = document.lineAt(document.lineCount - 1);
            const previousCell = cells[cells.length - 1];
            previousCell.range = new Range(previousCell.range.start, line.range.end);
        }

        editorCtx.set(cells.length > 0);
        return cells;
    }
}