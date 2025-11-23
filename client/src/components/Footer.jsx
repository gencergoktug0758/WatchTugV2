const Footer = () => {
  return (
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-50 animate-fade-in">
      <div className="flex items-center gap-2 text-xs sm:text-sm font-medium bg-dark-surface/90 backdrop-blur-sm px-4 py-2.5 sm:px-5 sm:py-3 rounded-lg border border-pink-500/30 shadow-lg hover:bg-dark-surface transition-all duration-300 hover:border-pink-500/50 hover:shadow-pink-500/20">
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-pink-500 to-purple-500 font-bold text-sm sm:text-base neon-pink">
          ECE
        </span>
        <span className="relative inline-block w-4 h-4 sm:w-5 sm:h-5">
          <span className="heart-simple absolute inset-0 flex items-center justify-center">
            <svg 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="w-full h-full text-pink-500 drop-shadow-[0_0_8px_rgba(236,72,153,0.8)]"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </span>
        </span>
      </div>
    </div>
  );
};

export default Footer;

