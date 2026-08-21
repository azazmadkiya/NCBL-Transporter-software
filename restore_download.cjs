const fs = require('fs');
let code = fs.readFileSync('src/components/PartyLedgerPrintModal.tsx', 'utf8');

const replacement = `const handleDownloadPDF = async () => {
    const content = printRef.current;
    
    if (content) {
      try {
        setIsGenerating(true);

        // Temporarily override parent styles to prevent cropping
        const scrollParent = content.parentElement;
        const modalCard = scrollParent?.parentElement;
        
        let oldScrollOverflow = '';
        let oldCardMaxHeight = '';
        let oldCardOverflow = '';

        if (scrollParent && modalCard) {
          oldScrollOverflow = scrollParent.style.overflow;
          oldCardMaxHeight = modalCard.style.maxHeight;
          oldCardOverflow = modalCard.style.overflow;

          scrollParent.style.overflow = 'visible';
          modalCard.style.maxHeight = 'none';
          modalCard.style.overflow = 'visible';
        }

        // Small delay to allow DOM to update
        await new Promise(resolve => setTimeout(resolve, 100));

        const canvas = await html2canvas(content, {
          scale: 2,
          useCORS: true,
          logging: false,
        });

        // Restore styles
        if (scrollParent && modalCard) {
          scrollParent.style.overflow = oldScrollOverflow;
          modalCard.style.maxHeight = oldCardMaxHeight;
          modalCard.style.overflow = oldCardOverflow;
        }

        const imgData = canvas.toDataURL('image/png', 1.0);
        const pdf = new jsPDF('l', 'pt', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfPageHeight = pdf.internal.pageSize.getHeight();
        
        // Calculate image height to maintain aspect ratio
        const imgHeight = (canvas.height * pdfWidth) / canvas.width;
        
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
        heightLeft -= pdfPageHeight;

        while (heightLeft > 0) {
          position -= pdfPageHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgHeight);
          heightLeft -= pdfPageHeight;
        }

        pdf.save(\`Ledger_\${party.name.replace(/\\s+/g, '_')}_\${new Date().toISOString().split('T')[0]}.pdf\`);
      } catch (error) {
        console.error('Error generating PDF:', error);
        alert('Failed to generate PDF: ' + (error instanceof Error ? error.message : String(error)));
      } finally {
        setIsGenerating(false);
      }
    }
  };`;

code = code.replace(/const handleDownloadPDF = \(\) => \{\s*handlePrint\(\);\s*\};/, replacement);
fs.writeFileSync('src/components/PartyLedgerPrintModal.tsx', code);
console.log("Success");
