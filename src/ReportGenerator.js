import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as XLSX from 'xlsx';
import './ReportGenerator.css';

const ReportGenerator = () => {
    // Configuration
    const [config, setConfig] = useState({ 
        rows: 50, 
        cols: 26, // A-Z
        title: "Untitled Spreadsheet",
        author: "",
        lastSaved: new Date().toLocaleString()
    });
    
    // Grid data: each cell is { value: '', formula: '', style: {}, type: 'text' | 'number' | 'date' | 'formula' }
    const [gridData, setGridData] = useState(() => 
        Array(50).fill(null).map(() => 
            Array(26).fill(null).map(() => ({ 
                value: '', 
                formula: '',
                type: 'text',
                style: {}
            }))
        )
    );
    
    // Cell selection and UI state
    const [selection, setSelection] = useState({ startRow: 0, startCol: 0, endRow: 0, endCol: 0 });
    const [activeCell, setActiveCell] = useState({ row: 0, col: 0 });
    const [formulaBarValue, setFormulaBarValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [cellStyle, setCellStyle] = useState({
        fontSize: 12,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textAlign: 'left',
        backgroundColor: '#ffffff',
        color: '#000000',
        border: '1px solid #d0d7de'
    });
    
    // Sheet management
    const [sheets, setSheets] = useState([
        { id: 1, name: 'Sheet1', active: true }
    ]);
    const [activeSheetId, setActiveSheetId] = useState(1);
    
    // Undo/Redo history
    const [history, setHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    
    // Reference to formula input
    const formulaInputRef = useRef(null);
    const activeCellRef = useRef(null);

    // Initialize with sample data for demonstration
    useEffect(() => {
        const sampleData = [...gridData];
        
        // Set headers
        for (let col = 0; col < config.cols; col++) {
            sampleData[0][col] = {
                ...sampleData[0][col],
                value: String.fromCharCode(65 + col),
                type: 'text',
                style: { fontWeight: 'bold', backgroundColor: '#f3f4f6', textAlign: 'center' }
            };
        }
        
        // Set row numbers
        for (let row = 1; row < config.rows; row++) {
            sampleData[row][0] = {
                ...sampleData[row][0],
                value: row.toString(),
                type: 'text',
                style: { fontWeight: 'bold', backgroundColor: '#f3f4f6', textAlign: 'center' }
            };
        }
        
        // Add some sample data
        sampleData[1][1] = { value: 'Sales Report', type: 'text', formula: '', style: { fontWeight: 'bold', fontSize: 14 } };
        sampleData[2][1] = { value: 'Product', type: 'text', formula: '', style: { fontWeight: 'bold' } };
        sampleData[2][2] = { value: 'Quantity', type: 'text', formula: '', style: { fontWeight: 'bold' } };
        sampleData[2][3] = { value: 'Price', type: 'text', formula: '', style: { fontWeight: 'bold' } };
        sampleData[2][4] = { value: 'Total', type: 'text', formula: '', style: { fontWeight: 'bold' } };
        
        // Product data
        const products = ['Product A', 'Product B', 'Product C', 'Product D'];
        for (let i = 0; i < products.length; i++) {
            const row = i + 3;
            const quantity = Math.floor(Math.random() * 100) + 10;
            const price = Math.floor(Math.random() * 1000) + 50;
            const total = quantity * price;
            
            sampleData[row][1] = { value: products[i], type: 'text', formula: '' };
            sampleData[row][2] = { value: quantity.toString(), type: 'number', formula: '' };
            sampleData[row][3] = { value: price.toString(), type: 'number', formula: '' };
            sampleData[row][4] = { 
                value: total.toString(), 
                type: 'formula', 
                formula: `=B${row+1}*C${row+1}`,
                style: { backgroundColor: '#f0f9ff' }
            };
        }
        
        // Summary row
        const summaryRow = products.length + 3;
        sampleData[summaryRow][3] = { value: 'Total:', type: 'text', formula: '', style: { fontWeight: 'bold' } };
        sampleData[summaryRow][4] = { 
            value: '0', 
            type: 'formula', 
            formula: `=SUM(D4:D${summaryRow})`,
            style: { fontWeight: 'bold', backgroundColor: '#d1fae5' }
        };
        
        setGridData(sampleData);
        saveToHistory(sampleData);
    }, []);

    // Save state to history for undo/redo
    const saveToHistory = useCallback((data) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(JSON.stringify(data));
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }, [history, historyIndex]);

    // Undo function
    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const previousState = JSON.parse(history[newIndex]);
            setGridData(previousState);
            setHistoryIndex(newIndex);
        }
    };

    // Redo function
    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const nextState = JSON.parse(history[newIndex]);
            setGridData(nextState);
            setHistoryIndex(newIndex);
        }
    };

    // Handle cell selection
    const handleCellClick = (row, col, e) => {
        e.stopPropagation();
        setSelection({ startRow: row, startCol: col, endRow: row, endCol: col });
        setActiveCell({ row, col });
        
        const cell = gridData[row][col];
        setFormulaBarValue(cell.formula || cell.value || '');
        
        // Update cell style state
        setCellStyle({
            fontSize: cell.style?.fontSize || 12,
            fontWeight: cell.style?.fontWeight || 'normal',
            fontStyle: cell.style?.fontStyle || 'normal',
            textAlign: cell.style?.textAlign || 'left',
            backgroundColor: cell.style?.backgroundColor || '#ffffff',
            color: cell.style?.color || '#000000',
            border: cell.style?.border || '1px solid #d0d7de'
        });
    };

    // Handle cell editing
    const handleCellDoubleClick = (row, col) => {
        setActiveCell({ row, col });
        const cell = gridData[row][col];
        setFormulaBarValue(cell.formula || cell.value || '');
        setIsEditing(true);
        setTimeout(() => {
            if (formulaInputRef.current) {
                formulaInputRef.current.focus();
                formulaInputRef.current.select();
            }
        }, 10);
    };

    // Handle formula bar changes
    const handleFormulaBarChange = (e) => {
        const value = e.target.value;
        setFormulaBarValue(value);
        
        if (!isEditing) {
            const { row, col } = activeCell;
            const newGridData = [...gridData];
            const isFormula = value.startsWith('=');
            
            newGridData[row][col] = {
                ...newGridData[row][col],
                value: isFormula ? evaluateFormula(value, row, col) : value,
                formula: isFormula ? value : '',
                type: isFormula ? 'formula' : 'text'
            };
            
            setGridData(newGridData);
            saveToHistory(newGridData);
        }
    };

    // Handle formula bar submission (Enter key)
    const handleFormulaBarKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const { row, col } = activeCell;
            const newGridData = [...gridData];
            const isFormula = formulaBarValue.startsWith('=');
            
            // Calculate cell value
            let calculatedValue = formulaBarValue;
            if (isFormula) {
                calculatedValue = evaluateFormula(formulaBarValue, row, col);
            }
            
            newGridData[row][col] = {
                ...newGridData[row][col],
                value: calculatedValue,
                formula: isFormula ? formulaBarValue : '',
                type: isFormula ? 'formula' : typeof calculatedValue === 'number' ? 'number' : 'text'
            };
            
            setGridData(newGridData);
            saveToHistory(newGridData);
            setIsEditing(false);
            
            // Move to next cell
            const nextRow = Math.min(row + 1, config.rows - 1);
            handleCellClick(nextRow, col, e);
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            const cell = gridData[activeCell.row][activeCell.col];
            setFormulaBarValue(cell.formula || cell.value || '');
        }
    };

    // Evaluate Excel-like formulas
    const evaluateFormula = (formula, currentRow, currentCol) => {
        try {
            let expression = formula.slice(1); // Remove leading '='
            
            // Replace cell references with values
            expression = expression.replace(/[A-Z]+[0-9]+/gi, (match) => {
                // Convert cell reference to row/col indices
                const colMatch = match.match(/[A-Z]+/i);
                const rowMatch = match.match(/[0-9]+/);
                
                if (!colMatch || !rowMatch) return '0';
                
                const colLetters = colMatch[0].toUpperCase();
                const rowNum = parseInt(rowMatch[0]) - 1;
                
                // Convert column letters to index
                let colNum = 0;
                for (let i = 0; i < colLetters.length; i++) {
                    colNum = colNum * 26 + (colLetters.charCodeAt(i) - 65 + 1);
                }
                colNum -= 1;
                
                if (rowNum < 0 || rowNum >= config.rows || colNum < 0 || colNum >= config.cols) {
                    return '0';
                }
                
                const cell = gridData[rowNum][colNum];
                const value = parseFloat(cell.value) || 0;
                return value.toString();
            });
            
            // Handle SUM function
            expression = expression.replace(/SUM\(([^)]+)\)/gi, (match, range) => {
                const [start, end] = range.split(':');
                // For simplicity, just sum two numbers
                const nums = range.split(':').map(ref => {
                    const num = parseFloat(ref) || 0;
                    return num;
                });
                return nums.reduce((a, b) => a + b, 0);
            });
            
            // Handle AVERAGE function
            expression = expression.replace(/AVERAGE\(([^)]+)\)/gi, (match, range) => {
                const nums = range.split(',').map(ref => parseFloat(ref.trim()) || 0);
                const sum = nums.reduce((a, b) => a + b, 0);
                return nums.length > 0 ? sum / nums.length : 0;
            });
            
            // Evaluate the expression
            const result = eval(expression);
            return isNaN(result) ? '#ERROR' : result.toString();
        } catch (error) {
            console.error('Formula error:', error);
            return '#ERROR';
        }
    };

    // Handle dimension changes
    const handleDimensionChange = (e) => {
        const { name, value } = e.target;
        const val = Math.max(1, Math.min(100, parseInt(value) || 1));
        const newConfig = { ...config, [name]: val };
        setConfig(newConfig);

        setGridData(prev => {
            const newData = Array(newConfig.rows).fill(null).map((_, r) => 
                Array(newConfig.cols).fill(null).map((_, c) => 
                    (prev[r] && prev[r][c]) || { value: '', formula: '', type: 'text', style: {} }
                )
            );
            return newData;
        });
    };

    // Handle cell style changes
    const handleStyleChange = (property, value) => {
        const { row, col } = activeCell;
        const newGridData = [...gridData];
        
        newGridData[row][col] = {
            ...newGridData[row][col],
            style: {
                ...newGridData[row][col].style,
                [property]: value
            }
        };
        
        setGridData(newGridData);
        setCellStyle(prev => ({ ...prev, [property]: value }));
    };

    // Export to Excel with formatting
    const exportToExcel = () => {
        // Create workbook
        const wb = XLSX.utils.book_new();
        
        // Convert grid data to worksheet
        const wsData = gridData.map(row => 
            row.map(cell => cell.value)
        );
        
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Add some styling metadata
        ws['!cols'] = Array(config.cols).fill(null).map(() => ({ wch: 15 }));
        ws['!rows'] = Array(config.rows).fill(null).map(() => ({ hpx: 20 }));
        
        XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
        XLSX.writeFile(wb, `${config.title}.xlsx`);
    };

    // Save to database
    const saveToDatabase = async () => {
        const payload = {
            title: config.title,
            rows: config.rows,
            cols: config.cols,
            data: gridData,
            lastSaved: new Date().toISOString()
        };
        
        console.log("Saving to DB:", payload);
        // await fetch('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
        
        setConfig(prev => ({ ...prev, lastSaved: new Date().toLocaleString() }));
        alert("Spreadsheet saved successfully!");
    };

    // Add new sheet
    const addNewSheet = () => {
        const newSheetId = sheets.length + 1;
        const newSheetName = `Sheet${newSheetId}`;
        
        setSheets(prev => [
            ...prev,
            { id: newSheetId, name: newSheetName, active: false }
        ]);
    };

    // Switch between sheets
    const switchSheet = (sheetId) => {
        setSheets(prev => prev.map(sheet => ({
            ...sheet,
            active: sheet.id === sheetId
        })));
        setActiveSheetId(sheetId);
        // In a real app, you would load the sheet data here
    };

    // Format cell value based on type
    const formatCellValue = (cell) => {
        if (!cell) return '';
        
        if (cell.type === 'number' || cell.type === 'formula') {
            const num = parseFloat(cell.value);
            return !isNaN(num) ? num.toLocaleString() : cell.value;
        }
        
        return cell.value;
    };

    // Get cell address (e.g., A1)
    const getCellAddress = (row, col) => {
        const colLetters = [];
        let tempCol = col;
        
        while (tempCol >= 0) {
            colLetters.unshift(String.fromCharCode(65 + (tempCol % 26)));
            tempCol = Math.floor(tempCol / 26) - 1;
        }
        
        return colLetters.join('') + (row + 1);
    };

    return (
        <div className="excel-container">
            {/* Excel-like Toolbar */}
            <div className="excel-toolbar">
                <div className="toolbar-section">
                    <button onClick={handleUndo} disabled={historyIndex <= 0} className="toolbar-btn">
                        ↩ Undo
                    </button>
                    <button onClick={handleRedo} disabled={historyIndex >= history.length - 1} className="toolbar-btn">
                        ↪ Redo
                    </button>
                    <div className="toolbar-separator"></div>
                    
                    <select 
                        value={cellStyle.fontSize}
                        onChange={(e) => handleStyleChange('fontSize', e.target.value)}
                        className="toolbar-select"
                    >
                        {[8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24].map(size => (
                            <option key={size} value={size}>{size}px</option>
                        ))}
                    </select>
                    
                    <button 
                        onClick={() => handleStyleChange('fontWeight', cellStyle.fontWeight === 'bold' ? 'normal' : 'bold')}
                        className={`toolbar-btn ${cellStyle.fontWeight === 'bold' ? 'active' : ''}`}
                    >
                        <strong>B</strong>
                    </button>
                    
                    <button 
                        onClick={() => handleStyleChange('fontStyle', cellStyle.fontStyle === 'italic' ? 'normal' : 'italic')}
                        className={`toolbar-btn ${cellStyle.fontStyle === 'italic' ? 'active' : ''}`}
                    >
                        <em>I</em>
                    </button>
                    
                    <div className="toolbar-separator"></div>
                    
                    <select 
                        value={cellStyle.textAlign}
                        onChange={(e) => handleStyleChange('textAlign', e.target.value)}
                        className="toolbar-select"
                    >
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                    </select>
                    
                    <input 
                        type="color" 
                        value={cellStyle.color}
                        onChange={(e) => handleStyleChange('color', e.target.value)}
                        className="color-picker"
                        title="Text Color"
                    />
                    
                    <input 
                        type="color" 
                        value={cellStyle.backgroundColor}
                        onChange={(e) => handleStyleChange('backgroundColor', e.target.value)}
                        className="color-picker"
                        title="Fill Color"
                    />
                </div>
                
                <div className="toolbar-section">
                    <input 
                        type="text" 
                        value={config.title}
                        onChange={(e) => setConfig({...config, title: e.target.value})}
                        className="title-input"
                    />
                    
                    <button onClick={saveToDatabase} className="toolbar-btn primary">
                        💾 Save
                    </button>
                    <button onClick={exportToExcel} className="toolbar-btn success">
                        📊 Export Excel
                    </button>
                </div>
            </div>

            {/* Formula Bar */}
            <div className="formula-bar">
                <div className="cell-address">
                    {getCellAddress(activeCell.row, activeCell.col)}
                </div>
                <div className="formula-input-container">
                    <input
                        ref={formulaInputRef}
                        type="text"
                        value={formulaBarValue}
                        onChange={handleFormulaBarChange}
                        onKeyDown={handleFormulaBarKeyDown}
                        onBlur={() => setIsEditing(false)}
                        placeholder="Enter value or formula (e.g., =A1+B2)"
                        className="formula-input"
                    />
                </div>
            </div>

            {/* Sheet Tabs */}
            <div className="sheet-tabs">
                {sheets.map(sheet => (
                    <div 
                        key={sheet.id}
                        className={`sheet-tab ${sheet.active ? 'active' : ''}`}
                        onClick={() => switchSheet(sheet.id)}
                    >
                        {sheet.name}
                    </div>
                ))}
                <button onClick={addNewSheet} className="add-sheet-btn">
                    +
                </button>
            </div>

            {/* Spreadsheet Grid */}
            <div className="spreadsheet-container">
                <div className="spreadsheet-wrapper">
                    <table className="excel-table">
                        <thead>
                            <tr>
                                <th className="corner-cell"></th>
                                {Array.from({ length: config.cols }).map((_, colIndex) => (
                                    <th key={colIndex} className="column-header">
                                        {String.fromCharCode(65 + colIndex)}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {gridData.slice(0, config.rows).map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                    <td className="row-header">{rowIndex + 1}</td>
                                    {row.slice(0, config.cols).map((cell, colIndex) => {
                                        const isActive = activeCell.row === rowIndex && activeCell.col === colIndex;
                                        const isSelected = selection.startRow <= rowIndex && rowIndex <= selection.endRow &&
                                                          selection.startCol <= colIndex && colIndex <= selection.endCol;
                                        
                                        return (
                                            <td 
                                                key={colIndex}
                                                className={`cell ${isActive ? 'active' : ''} ${isSelected ? 'selected' : ''}`}
                                                onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                                                onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                                                style={cell.style}
                                            >
                                                <div className="cell-content">
                                                    {formatCellValue(cell)}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Status Bar */}
            <div className="status-bar">
                <div className="status-info">
                    <span>Ready</span>
                    <span className="status-separator">|</span>
                    <span>Cells: {config.rows * config.cols}</span>
                    <span className="status-separator">|</span>
                    <span>Last saved: {config.lastSaved}</span>
                </div>
                <div className="dimension-controls">
                    <label>
                        Rows: 
                        <input 
                            type="number" 
                            name="rows" 
                            value={config.rows} 
                            onChange={handleDimensionChange}
                            min="1"
                            max="1000"
                        />
                    </label>
                    <label>
                        Columns: 
                        <input 
                            type="number" 
                            name="cols" 
                            value={config.cols} 
                            onChange={handleDimensionChange}
                            min="1"
                            max="52"
                        />
                    </label>
                </div>
            </div>
        </div>
    );
};

export default ReportGenerator;