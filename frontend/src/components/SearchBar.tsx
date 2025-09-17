import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// Search suggestion interface
interface SearchSuggestion {
  id: string;
  title: string;
  category?: string;
  type: 'product' | 'category' | 'suggestion';
}

// Props interface for the SearchBar component
interface SearchBarProps {
  placeholder?: string;
  suggestions?: SearchSuggestion[];
  onSearch?: (query: string) => void;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
  className?: string;
  showSuggestions?: boolean;
  isLoading?: boolean;
}

export default function SearchBar({
  placeholder = "Search products, categories...",
  suggestions = [],
  onSearch,
  onSuggestionSelect,
  className = "",
  showSuggestions = true,
  isLoading = false
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter suggestions based on query
  const filteredSuggestions = suggestions.filter(suggestion =>
    suggestion.title.toLowerCase().includes(query.toLowerCase())
  ).slice(0, 8); // Limit to 8 suggestions

  // Default suggestions when query is empty
  const defaultSuggestions: SearchSuggestion[] = [
    { id: 'phones', title: 'Phones', type: 'category' },
    { id: 'computers', title: 'Computers', type: 'category' },
    { id: 'smartwatches', title: 'Smart Watches', type: 'category' },
    { id: 'cameras', title: 'Cameras', type: 'category' },
    { id: 'headphones', title: 'Headphones', type: 'category' },
    { id: 'gaming', title: 'Gaming', type: 'category' }
  ];

  const displaySuggestions = query.trim() ? filteredSuggestions : defaultSuggestions;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      handleSearch(query.trim());
    }
  };

  const handleSearch = (searchQuery: string) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    
    if (onSearch) {
      onSearch(searchQuery);
    } else {
      // Default behavior - navigate to products page with search
      navigate(`/products?search=${encodeURIComponent(searchQuery)}`);
    }
  };

  const handleSuggestionClick = (suggestion: SearchSuggestion) => {
    setQuery(suggestion.title);
    setIsOpen(false);
    setSelectedIndex(-1);
    
    if (onSuggestionSelect) {
      onSuggestionSelect(suggestion);
    } else {
      // Default behavior based on suggestion type
      if (suggestion.type === 'category') {
        navigate(`/products?category=${suggestion.id}`);
      } else {
        handleSearch(suggestion.title);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen || displaySuggestions.length === 0) {
      if (e.key === 'ArrowDown' && !isOpen && showSuggestions) {
        setIsOpen(true);
        setSelectedIndex(0);
        e.preventDefault();
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < displaySuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : displaySuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0) {
          handleSuggestionClick(displaySuggestions[selectedIndex]);
        } else {
          handleSubmit(e);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    setSelectedIndex(-1);
    
    if (showSuggestions) {
      setIsOpen(true);
    }
  };

  const handleInputFocus = () => {
    if (showSuggestions) {
      setIsOpen(true);
    }
  };

  const getSuggestionIcon = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'category':
        return '📂';
      case 'product':
        return '🔍';
      default:
        return '💡';
    }
  };

  return (
    <div ref={searchRef} className={`relative w-full ${className}`}>
      <form onSubmit={handleSubmit} className="relative">
        <div className="relative">
          {/* Search Icon */}
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Search Input */}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white shadow-sm text-gray-900 placeholder-gray-500"
            autoComplete="off"
          />

          {/* Loading Spinner */}
          {isLoading && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <div className="animate-spin h-5 w-5 text-gray-400">
                <svg fill="none" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} className="opacity-25" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              </div>
            </div>
          )}

          {/* Clear Button */}
          {query && !isLoading && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </form>

      {/* Suggestions Dropdown */}
      {isOpen && showSuggestions && displaySuggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-80 overflow-y-auto">
          {displaySuggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => handleSuggestionClick(suggestion)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-b border-gray-100 last:border-b-0 transition-colors ${
                index === selectedIndex ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
              }`}
            >
              <span className="text-lg">{getSuggestionIcon(suggestion.type)}</span>
              <div className="flex-1">
                <div className="font-medium">{suggestion.title}</div>
                {suggestion.category && (
                  <div className="text-sm text-gray-500">in {suggestion.category}</div>
                )}
              </div>
              <div className="text-xs text-gray-400 capitalize">
                {suggestion.type}
              </div>
            </button>
          ))}
          
          {/* Search query option */}
          {query.trim() && !filteredSuggestions.find(s => s.title.toLowerCase() === query.toLowerCase()) && (
            <button
              type="button"
              onClick={() => handleSearch(query)}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 flex items-center gap-3 border-t border-gray-200 transition-colors ${
                selectedIndex === displaySuggestions.length ? 'bg-blue-50 text-blue-700' : 'text-gray-900'
              }`}
            >
              <span className="text-lg">🔍</span>
              <div className="flex-1">
                <div className="font-medium">Search for "{query}"</div>
              </div>
            </button>
          )}
        </div>
      )}
    </div>
  );
}