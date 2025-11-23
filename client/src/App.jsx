import { useState, useEffect } from 'react';
import { SocketProvider } from './context/SocketContext';
import { useStore } from './store/useStore';
import Login from './components/Login';
import Room from './components/Room';

function App() {
  const { roomId, username, userId } = useStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Sayfa yüklendiğinde localStorage'dan verileri kontrol et
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-dark-text text-xl">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <SocketProvider>
      <div className="min-h-screen bg-dark-bg">
        {roomId && username && userId ? (
          <Room />
        ) : (
          <Login />
        )}
      </div>
    </SocketProvider>
  );
}

export default App;

