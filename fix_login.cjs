const fs = require('fs');
let code = fs.readFileSync('src/components/LoginPage.tsx', 'utf8');

const regexToReplace = /if \(cleanId\.toLowerCase\(\) === 'azazmadkiya' && cleanPass === '9687709315'\) \{[\s\S]*?\} else \{/g;

const replacement = `if (cleanId.toLowerCase() === 'azazmadkiya' && cleanPass === '9687709315') {
        const user: UserProfile = {
          uid: 'user-azazmadkiya',
          displayName: 'Azazmadkiya',
          email: 'azazmadkiya@nirmalatransport.com',
          role: 'admin'
        };
        onLoginSuccess(user);
      } else if (cleanId.toLowerCase() === 'nileshpoojara' && cleanPass === '9825731735') {
        const user: UserProfile = {
          uid: 'user-nileshpoojara',
          displayName: 'Nilesh Poojara',
          email: 'nileshpoojara@nirmalatransport.com',
          role: 'viewer'
        };
        onLoginSuccess(user);
      } else if (cleanId.toLowerCase() === 'tarundesai' && cleanPass === '9725580909') {
        const user: UserProfile = {
          uid: 'user-tarundesai',
          displayName: 'Tarun Desai',
          email: 'tarundesai@nirmalatransport.com',
          role: 'viewer'
        };
        onLoginSuccess(user);
      } else {`;

code = code.replace(regexToReplace, replacement);
fs.writeFileSync('src/components/LoginPage.tsx', code);
console.log("Success");
