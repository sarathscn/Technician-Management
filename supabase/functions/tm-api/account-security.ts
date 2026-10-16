export function createTemporaryPassword():string {
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
 const bytes=crypto.getRandomValues(new Uint8Array(20));
 return 'Tm!2'+Array.from(bytes,value=>alphabet[value&63]).join('');
}
