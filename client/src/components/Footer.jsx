const Footer = () => {
  return (
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 animate-fade-in">
      <div className="flex items-center gap-1.5 text-dark-text2 text-xs sm:text-sm font-medium bg-dark-surface/90 backdrop-blur-sm px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg border border-dark-surface2/50 shadow-lg hover:bg-dark-surface transition-colors">
        <span className="text-dark-text">ECE</span>
        <span className="relative inline-block w-3 h-3 sm:w-4 sm:h-4">
          <span className="heart-simple absolute inset-0 flex items-center justify-center">
            <svg 
              viewBox="0 0 24 24" 
              fill="currentColor" 
              className="w-full h-full text-dark-accent"
            >
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </span>
        </span>
        <span className="text-xs opacity-75">3</span>
      </div>
    </div>
  );
};

export default Footer;

