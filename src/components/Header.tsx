
import React from 'react';
import { Sparkles, Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Header = () => {
  return (
    <header className="bg-background border-b border-border shadow-sm">
      <div className="container mx-auto px-4 py-6 relative">
        <Link to="/admin" aria-label="Área restrita" className="absolute right-3 top-3 opacity-20 hover:opacity-60 transition-opacity">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        </Link>
        <div className="flex items-center justify-center space-x-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <h1 className="text-2xl md:text-3xl font-bold text-foreground text-center">
            laryssaresende.nails
          </h1>
          <Sparkles className="h-8 w-8 text-primary scale-x-[-1]" />
        </div>
        <p className="text-center text-muted-foreground mt-2 text-sm">
          Agendamento Online
        </p>
      </div>
    </header>
  );
};
