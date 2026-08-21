const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

code = code.replace(
  /const handleDownloadPDF = async \(\) => \{[\s\S]*?\}\s*catch \(error\) \{[\s\S]*?\}\s*\};/,
  `const handleDownloadPDF = () => {
    handlePrint();
  };`
);

fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
