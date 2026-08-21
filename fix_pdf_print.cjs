const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

const replacement = `const handleDownloadPDF = () => {
    handlePrint();
  };`;

code = code.replace(/const handleDownloadPDF = async \(\) => \{[\s\S]*?\}\s*catch \(error\) \{[\s\S]*?\}\s*finally \{[\s\S]*?\}\s*\};/, replacement);
fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
