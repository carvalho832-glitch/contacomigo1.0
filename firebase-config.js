export const firebaseConfig = {
  apiKey: "AIzaSyBlYAfQKjcgMnHRuaLuyZcI-5Rb-Y1DyQw",
  authDomain: "contacomigo-app-832.firebaseapp.com",
  projectId: "contacomigo-app-832",
  storageBucket: "contacomigo-app-832.firebasestorage.app",
  messagingSenderId: "307035578031",
  appId: "1:307035578031:web:1957150aacc8921a33be5a"
};

export function hasFirebaseConfig() {
  return Boolean(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.appId
  );
}
