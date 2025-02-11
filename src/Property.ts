'use strict';

import * as vscode from 'vscode';

export default class Property {
    private description: string = null;
    private indentation: string;
    private name: string;
    private type: string = null;
    private typeHint: string = null;
    private pseudoTypes = ['mixed', 'number', 'callback', 'array|object', 'void', 'null', 'integer'];

    public constructor(name: string)
    {
        this.name = name;
    }

    /**
     * Check if a property is defined in the provided line
     * @param line Line of the editor.document to search for a property
     * @returns Boolean. True if the line defines a property, false otherwise
     */
    static isAProperty(line: vscode.TextLine) {
        const text = line.text;

        if (
            /^\s*(private|public|protected\b)\s\$[a-zA-Z_]+[a-zA-Z_0-9]*/.test(
                text
            )
        ) {
            return true;
        }

        return false;
    }

    /**
     * Search for and get the property in a line of the provided document if exists
     * @param editor Vscode active text editor
     * @param line Line of the editor.document to search for a property
     * @returns Property object if found, null in other case
     */
    static fromLine(
        editor: vscode.TextEditor,
        line: vscode.TextLine
    ): Property | null {
        const position = new vscode.Position(
            line.lineNumber,
            line.range.end.character - 1 // Avoid semicolon
        );

        if (Property.isAProperty(line))
            return Property.fromEditorPosition(editor, position);

        return null;
    }

    static fromEditorPosition(editor: vscode.TextEditor, activePosition: vscode.Position) {
        const wordRange = editor.document.getWordRangeAtPosition(activePosition);

        let selectedWord = undefined

        if (wordRange !== undefined) {
            // throw new Error('No property found. Please select a property to use this extension.');
            selectedWord = editor.document.getText(wordRange);
        } else if (selectedWord === undefined || selectedWord[0] !== '$') {
            const matchWord = editor.document.lineAt(activePosition.line).text.match(/\$[a-zA-Z_]*/);

            if (null === matchWord) {
                throw new Error('No property found. Please select a property to use this extension.');
            }
            selectedWord = matchWord[0];
        } else {
            throw new Error('No property found. Please select a property to use this extension.');
        }
        let property = new Property(selectedWord.substring(1, selectedWord.length));

        const activeLineNumber = activePosition.line;
        const activeLine = editor.document.lineAt(activeLineNumber);
        const activeLineTokens = activeLine.text.slice(0, -1).split(' ');
        const typehint = activeLineTokens[activeLineTokens.indexOf(selectedWord) - 1];

        if (typehint !== 'public' && typehint !== 'private' && typehint !== 'protected') {
            property.setType(typehint);
        }

        property.indentation = activeLine.text.substring(0, activeLine.firstNonWhitespaceCharacterIndex);

        const previousLineNumber = activeLineNumber - 1;

        if (previousLineNumber <= 0) {
            return property;
        }

        const previousLine = editor.document.lineAt(previousLineNumber);

        // No doc block found
        if (!previousLine.text.endsWith('*/')) {
            return property;
        }

        for (let line = previousLineNumber - 1; line > 0; line--) {
            // Everything found
            if (property.name && property.type && property.description) {
                break;
            }

            const text = editor.document.lineAt(line).text;

            // Reached the end of the doc block
            if (text.includes('/**') || !text.includes('*')) {
                break;
            }

            // Remove spaces & tabs
            const lineParts = text.split(' ').filter(function(value){
                return value !== '' && value !== "\t" && value !== "*";
            });

            const varPosition = lineParts.indexOf('@var');

            // Found @var line
            if (-1 !== varPosition) {
                property.setType(lineParts[varPosition + 1]);

                var descriptionParts = lineParts.slice(varPosition + 2);

                if (descriptionParts.length) {
                    property.description = descriptionParts.join(` `);
                }

                continue;
            }

            const posibleDescription = lineParts.join(` `);

            if (posibleDescription[0] !== '@') {
                property.description = posibleDescription;
            }
        }

        return property;
    }

    static fromEditorSelection(editor: vscode.TextEditor) {
        return Property.fromEditorPosition(editor, editor.selection.active);
    }

    generateMethodDescription(prefix : string) : string {
        if (this.description) {
            return prefix + this.description.charAt(0).toLowerCase() + this.description.substring(1);
        }

        return prefix + `the value of ` + this.name;
    }

    generateMethodName(prefix : string) : string {
        let name = this.name.split('_')
            .map(str => str.charAt(0).toLocaleUpperCase() + str.slice(1))
            .join('');
        return prefix + name;
    }

    getDescription() : string {
        return this.description;
    }

    getIndentation() : string {
        return this.indentation;
    }

    getName() : string {
        return this.name;
    }

    getterDescription() : string {
        return this.generateMethodDescription('Get ');
    }

    getterName() : string {
        return this.generateMethodName(this.type === 'bool' ? 'is' : 'get');
    }

    getType() : string {
        return this.type;
    }

    getTypeHint() : string {
        return this.typeHint;
    }

    isValidTypeHint(type : string) {
        return (-1 === type.indexOf('|') && -1 === this.pseudoTypes.indexOf(type));
    }

    setterDescription() : string {
        return this.generateMethodDescription('Set ');
    }

    setterName() : string {
        return this.generateMethodName('set');
    }

    setType(type : string) {
        this.type = type;

        if (type.indexOf('[]') > 0) {
            type = 'array';
        }

        if (this.isValidTypeHint(type)) {
            this.typeHint = type;
        }
    }
}
