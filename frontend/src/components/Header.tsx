import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Header() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleLogout = () => {
    logout();
    navigate('/');
    setIsMenuOpen(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="w-full bg-white shadow-sm">
      {/* Main header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link to="/" className="text-2xl font-bold text-[#17183b] hover:opacity-80 transition-opacity">
              EcomsWeb
            </Link>
          </div>

          {/* Desktop search */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <form onSubmit={handleSearch} className="w-full">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </form>
          </div>

          {/* Desktop navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/" className="text-gray-900 hover:text-gray-600 font-medium">
              Home
            </Link>
            <Link to="/products" className="text-gray-900 hover:text-gray-600 font-medium">
              Products
            </Link>
            {isAuthenticated && (
              <Link to="/orders" className="text-gray-900 hover:text-gray-600 font-medium">
                Orders
              </Link>
            )}
          </nav>

          {/* Desktop icons */}
          <div className="hidden md:flex items-center space-x-6">
            <Link to="/favorites" className="text-gray-500 hover:text-gray-700">
              <span className="text-xl">♥</span>
            </Link>
            <Link to="/cart" className="text-gray-500 hover:text-gray-700">
              <span className="text-xl">🛒</span>
            </Link>
            
            {/* User menu */}
            <div className="relative group">
              {isAuthenticated ? (
                <>
                  <button className="text-gray-500 hover:text-gray-700">
                    <span className="text-xl">👤</span>
                  </button>
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-2 min-w-[160px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="text-sm text-gray-900">Welcome, {user?.name}</p>
                    </div>
                    <Link to="/orders" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                      Order History
                    </Link>
                    <button
                      onClick={handleLogout}
                      className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              ) : (
                <Link to="/auth" className="text-gray-500 hover:text-gray-700">
                  <span className="text-xl">👤</span>
                </Link>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden flex items-center justify-center h-8 w-8 text-gray-500 hover:text-gray-700"
          >
            <span className="text-xl">{isMenuOpen ? '✕' : '☰'}</span>
          </button>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden border-t border-gray-200 py-4">
            {/* Mobile search */}
            <div className="mb-4">
              <form onSubmit={handleSearch} className="w-full">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products..."
                  className="w-full px-4 py-2 bg-gray-100 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </form>
            </div>
            
            {/* Mobile navigation */}
            <div className="space-y-2">
              <Link
                to="/"
                onClick={() => setIsMenuOpen(false)}
                className="block py-2 text-gray-900 hover:text-gray-600 font-medium"
              >
                Home
              </Link>
              <Link
                to="/products"
                onClick={() => setIsMenuOpen(false)}
                className="block py-2 text-gray-900 hover:text-gray-600 font-medium"
              >
                Products
              </Link>
              {isAuthenticated && (
                <Link
                  to="/orders"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-2 text-gray-900 hover:text-gray-600 font-medium"
                >
                  Orders
                </Link>
              )}
              <Link
                to="/favorites"
                onClick={() => setIsMenuOpen(false)}
                className="block py-2 text-gray-900 hover:text-gray-600 font-medium"
              >
                Favorites
              </Link>
              <Link
                to="/cart"
                onClick={() => setIsMenuOpen(false)}
                className="block py-2 text-gray-900 hover:text-gray-600 font-medium"
              >
                Cart
              </Link>
            </div>

            {/* Mobile user section */}
            <div className="mt-4 pt-4 border-t border-gray-200">
              {isAuthenticated ? (
                <>
                  <div className="mb-2">
                    <p className="text-sm text-gray-900">Welcome, {user?.name}</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="block w-full text-left py-2 text-gray-900 hover:text-gray-600 font-medium"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <Link
                  to="/auth"
                  onClick={() => setIsMenuOpen(false)}
                  className="block py-2 text-gray-900 hover:text-gray-600 font-medium"
                >
                  Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category navigation */}
      <div className="bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-center space-x-8 py-2 overflow-x-auto">
            <Link to="/products?category=phones" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="text-lg">📱</span>
              <span className="text-sm font-medium">Phones</span>
            </Link>
            <Link to="/products?category=computers" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="text-lg">💻</span>
              <span className="text-sm font-medium">Computers</span>
            </Link>
            <Link to="/products?category=smartwatches" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="text-lg">⌚</span>
              <span className="text-sm font-medium">Watches</span>
            </Link>
            <Link to="/products?category=cameras" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="text-lg">📷</span>
              <span className="text-sm font-medium">Cameras</span>
            </Link>
            <Link to="/products?category=headphones" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="text-lg">🎧</span>
              <span className="text-sm font-medium">Audio</span>
            </Link>
            <Link to="/products?category=gaming" className="flex items-center gap-2 text-white/70 hover:text-white transition-colors">
              <span className="text-lg">🎮</span>
              <span className="text-sm font-medium">Gaming</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
