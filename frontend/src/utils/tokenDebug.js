// Token debugging utility
export const debugToken = () => {
  const token = localStorage.getItem('token');
  const user = localStorage.getItem('user');

  if (!token) {
    console.log('❌ No token found in localStorage');
    return { hasToken: false };
  }

  console.log('✅ Token found in localStorage');
  
  try {
    // Decode JWT (without verification)
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    const payload = JSON.parse(jsonPayload);
    const now = Math.floor(Date.now() / 1000);
    const isExpired = payload.exp < now;
    const expiresIn = payload.exp - now;

    console.log('📝 Token Payload:', payload);
    console.log('⏰ Issued at:', new Date(payload.iat * 1000).toLocaleString());
    console.log('⏰ Expires at:', new Date(payload.exp * 1000).toLocaleString());
    console.log('⏱️  Current time:', new Date().toLocaleString());
    
    if (isExpired) {
      console.log('❌ Token is EXPIRED');
      console.log(`   Expired ${Math.abs(expiresIn)} seconds ago`);
    } else {
      console.log('✅ Token is VALID');
      console.log(`   Expires in ${expiresIn} seconds (${Math.floor(expiresIn / 60)} minutes)`);
    }

    if (user) {
      console.log('👤 User:', JSON.parse(user));
    }

    return {
      hasToken: true,
      isExpired,
      expiresIn,
      payload,
      user: user ? JSON.parse(user) : null
    };
  } catch (error) {
    console.error('❌ Error decoding token:', error);
    return { hasToken: true, error: true };
  }
};

// Make it available globally in development
if (import.meta.env.DEV) {
  window.debugToken = debugToken;
}

export default debugToken;


