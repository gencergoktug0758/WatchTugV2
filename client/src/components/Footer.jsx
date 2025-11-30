import { Heart } from 'lucide-react';

const Footer = () => {
  return (
    <div className="fixed bottom-4 right-4 z-40 animate-fade-in">
      <div className="flex items-center gap-2 text-sm font-medium glass-card px-4 py-2.5 rounded-xl hover:shadow-neon-pink transition-all duration-300 group cursor-default">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 font-bold neon-pink">
          AYSU
        </span>
        <Heart 
          className="w-4 h-4 text-pink-500 heart-simple group-hover:scale-110 transition-transform" 
          fill="currentColor" 
        />
      </div>
    </div>
  );
};

export default Footer;
