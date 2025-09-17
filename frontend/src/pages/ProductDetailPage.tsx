import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/apiClient';

interface Product {
  _id: string;
  name: string;
  price: number;
  image: string;
  description: string;
  category: string;
  stockQuantity: number;
  createdAt: string;
}

// Star components for ratings
const StarFilled = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 1L12.09 6.26L18 7L13 11.74L14.18 17.5L10 15.27L5.82 17.5L7 11.74L2 7L7.91 6.26L10 1Z" fill="#FFB547"/>
  </svg>
);

const StarEmpty = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M10 1L12.09 6.26L18 7L13 11.74L14.18 17.5L10 15.27L5.82 17.5L7 11.74L2 7L7.91 6.26L10 1Z" stroke="#FFB547" strokeWidth="1" fill="none"/>
  </svg>
);

// Icons for features
const DeliveryIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M19 7h-3V6a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v11a3 3 0 0 0 3 3h.78a3 3 0 0 0 5.44 0h2.56a3 3 0 0 0 5.44 0H21a1 1 0 0 0 1-1v-4a1 1 0 0 0-.22-.624l-3-4A1 1 0 0 0 18 9h-1V7z" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
    <circle cx="7" cy="17" r="1" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
    <circle cx="17" cy="17" r="1" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
  </svg>
);

const StockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
    <path d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
    <path d="M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
  </svg>
);

const GuaranteeIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
    <path d="M9 12l2 2 4-4" stroke="#4e4e4e" strokeWidth="1.5" fill="none"/>
  </svg>
);

const HeartIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="#666" strokeWidth="1.5" fill="none"/>
  </svg>
);

const ArrowDownIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="m4 6 4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

// Product Card component for related products
const ProductCard: React.FC<{ product: Product }> = ({ product }) => {
  const navigate = useNavigate();

  return (
    <div className="bg-gray-50 rounded-lg p-4 flex flex-col items-center gap-2">
      <div className="w-full flex justify-end">
        <button className="p-2 hover:bg-gray-200 rounded-full transition-colors">
          <HeartIcon />
        </button>
      </div>
      
      <img 
        src={product.image} 
        alt={product.name}
        className="w-24 h-24 object-cover rounded"
      />
      
      <div className="text-center space-y-2 w-full">
        <h3 className="font-medium text-sm text-gray-900 line-clamp-2">
          {product.name}
        </h3>
        <p className="font-semibold text-lg text-gray-900">
          ${product.price}
        </p>
      </div>
      
      <button 
        onClick={() => navigate(`/product/${product._id}`)}
        className="w-full bg-black text-white py-2 px-4 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
      >
        Buy Now
      </button>
    </div>
  );
};

export const ProductDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [selectedStorage, setSelectedStorage] = useState('1TB');
  const [selectedColor, setSelectedColor] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [showFullDetails, setShowFullDetails] = useState(false);

  // Mock data for colors (in a real app, this would come from the product data)
  const colors = [
    { name: 'Deep Purple', color: '#5A5B9F' },
    { name: 'Gold', color: '#FAD5A5' },
    { name: 'Silver', color: '#F5F5DC' },
    { name: 'Space Black', color: '#2F2F2F' },
    { name: 'Purple', color: '#C0B7E8' }
  ];

  const storageOptions = ['128GB', '256GB', '512GB', '1TB'];

  // Mock product images (in a real app, these would come from the product data)
  const productImages = [
    product?.image || '/api/placeholder/300/300',
    '/api/placeholder/300/300',
    '/api/placeholder/300/300',
    '/api/placeholder/300/300'
  ];

  // Mock reviews data
  const reviews = [
    {
      id: 1,
      name: 'Grace Carey',
      date: '24 January, 2023',
      rating: 5,
      comment: 'I was a bit nervous to be buying a secondhand phone from Amazon, but I couldn\'t be happier with my purchase!! I have a pre-paid data plan so I was worried that this phone wouldn\'t connect with my data plan, since the new phones don\'t have the physical Sim tray anymore, but couldn\'t have been easier!',
      images: []
    },
    {
      id: 2,
      name: 'Ronald Richards',
      date: '24 January, 2023',
      rating: 4,
      comment: 'This phone has 1T storage and is durable. Plus all the new iPhones have a C port! Apple is phasing out the current ones! So if you want a phone that\'s going to last grab an iPhone 14 pro max and get several cords and plugs.',
      images: []
    },
    {
      id: 3,
      name: 'Darcy King',
      date: '24 January, 2023',
      rating: 5,
      comment: 'I might be the only one to say this but the camera is a little funky. Hoping it will change with a software update: otherwise, love this phone! Came in great condition',
      images: ['/api/placeholder/120/90', '/api/placeholder/120/90']
    }
  ];

  useEffect(() => {
    const fetchProduct = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const response = await api.products.getById(id);
        setProduct(response.data);
        
        // Fetch related products (in the same category)
        const allProductsResponse = await api.products.getAll();
        const related = allProductsResponse.data
          .filter((p: Product) => p._id !== id && p.category === response.data.category)
          .slice(0, 4);
        setRelatedProducts(related);
      } catch (error) {
        console.error('Error fetching product:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [id]);

  const handleAddToCart = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    try {
      await api.cart.add(id!, 1);
      alert('Product added to cart!');
    } catch (error) {
      console.error('Error adding to cart:', error);
      alert('Failed to add to cart');
    }
  };

  const handleAddToWishlist = async () => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    try {
      // In a real app, you'd call the wishlist API here
      console.log('Adding to wishlist:', product?._id);
      alert('Product added to wishlist!');
    } catch (error) {
      console.error('Error adding to wishlist:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Product not found</h1>
        <button 
          onClick={() => navigate('/products')}
          className="bg-black text-white px-6 py-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          Back to Products
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">TechStore</h1>
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M19 12H5m7-7-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="px-4 py-6 space-y-8">
        {/* Product Images */}
        <section className="flex flex-col items-center gap-8">
          <img 
            src={productImages[selectedImageIndex]}
            alt={product.name}
            className="w-64 h-80 object-cover rounded-lg"
          />
          
          <div className="flex gap-4 w-full justify-center">
            {productImages.map((image, index) => (
              <button
                key={index}
                onClick={() => setSelectedImageIndex(index)}
                className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                  selectedImageIndex === index ? 'border-black' : 'border-gray-200 opacity-40'
                }`}
              >
                <img 
                  src={image}
                  alt={`${product.name} view ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </section>

        {/* Product Info */}
        <section className="space-y-6">
          <div className="space-y-4">
            <h1 className="text-3xl font-bold text-gray-900 leading-tight">
              {product.name}
            </h1>
            
            <div className="flex items-center gap-4">
              <span className="text-2xl font-semibold text-gray-900">
                ${product.price}
              </span>
              <span className="text-lg text-gray-400 line-through">
                ${Math.round(product.price * 1.2)}
              </span>
            </div>
          </div>

          {/* Color Selection */}
          <div className="space-y-4">
            <p className="text-gray-700">Select color:</p>
            <div className="flex gap-2">
              {colors.map((color, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedColor(index)}
                  className={`w-8 h-8 rounded-full border-2 transition-colors ${
                    selectedColor === index ? 'border-gray-900' : 'border-gray-300 hover:border-gray-500'
                  }`}
                  style={{ backgroundColor: color.color }}
                  title={color.name}
                />
              ))}
            </div>
          </div>

          {/* Storage Selection */}
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-2">
              {storageOptions.map((storage) => (
                <button
                  key={storage}
                  onClick={() => setSelectedStorage(storage)}
                  className={`py-3 px-4 rounded-lg border text-sm font-medium transition-all ${
                    selectedStorage === storage
                      ? 'border-black text-black'
                      : 'border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {storage}
                </button>
              ))}
            </div>
          </div>

          {/* Product Details Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-3">
              <div className="w-6 h-6 text-gray-600">📱</div>
              <div>
                <p className="text-xs text-gray-500">Screen size</p>
                <p className="font-medium text-gray-900">6.7"</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-3">
              <div className="w-6 h-6 text-gray-600">⚡</div>
              <div>
                <p className="text-xs text-gray-500">CPU</p>
                <p className="font-medium text-gray-900">Apple A16 Bionic</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-3">
              <div className="w-6 h-6 text-gray-600">🔧</div>
              <div>
                <p className="text-xs text-gray-500">Number of Cores</p>
                <p className="font-medium text-gray-900">6</p>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg flex items-center gap-3">
              <div className="w-6 h-6 text-gray-600">📷</div>
              <div>
                <p className="text-xs text-gray-500">Main camera</p>
                <p className="font-medium text-gray-900">48-12-12 MP</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <p className="text-gray-600 text-sm leading-relaxed">
              {showFullDescription ? product.description : `${product.description.slice(0, 150)}...`}
              <button 
                onClick={() => setShowFullDescription(!showFullDescription)}
                className="text-gray-900 underline ml-1"
              >
                {showFullDescription ? 'less' : 'more...'}
              </button>
            </p>
          </div>
        </section>

        {/* Action Buttons */}
        <section className="space-y-4">
          <button 
            onClick={handleAddToWishlist}
            className="w-full py-4 border border-black text-black rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Add to Wishlist
          </button>
          
          <button 
            onClick={handleAddToCart}
            className="w-full py-4 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Add to Cart
          </button>
        </section>

        {/* Features */}
        <section className="grid grid-cols-3 gap-4">
          <div className="text-center space-y-3">
            <div className="bg-gray-50 p-4 rounded-xl flex justify-center">
              <DeliveryIcon />
            </div>
            <div>
              <p className="text-sm text-gray-600">Free Delivery</p>
              <p className="text-sm font-medium text-gray-900">1-2 day</p>
            </div>
          </div>
          
          <div className="text-center space-y-3">
            <div className="bg-gray-50 p-4 rounded-xl flex justify-center">
              <StockIcon />
            </div>
            <div>
              <p className="text-sm text-gray-600">In Stock</p>
              <p className="text-sm font-medium text-gray-900">Today</p>
            </div>
          </div>
          
          <div className="text-center space-y-3">
            <div className="bg-gray-50 p-4 rounded-xl flex justify-center">
              <GuaranteeIcon />
            </div>
            <div>
              <p className="text-sm text-gray-600">Guaranteed</p>
              <p className="text-sm font-medium text-gray-900">1 year</p>
            </div>
          </div>
        </section>

        {/* Technical Details */}
        <section className="bg-gray-50 p-6 rounded-lg space-y-6">
          <div className="bg-white p-6 rounded-lg space-y-6">
            <h2 className="text-xl font-medium text-gray-900">Details</h2>
            
            <p className="text-sm text-gray-600 leading-relaxed">
              Just as a book is judged by its cover, the first thing you notice when you pick up a modern smartphone is the display. 
              Nothing surprising, because advanced technologies allow you to practically level the display frames...
            </p>

            {showFullDetails && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">Screen</h3>
                  <div className="space-y-3">
                    {[
                      ['Screen diagonal', '6.7"'],
                      ['The screen resolution', '2796x1290'],
                      ['The screen refresh rate', '120 Hz'],
                      ['The pixel density', '460 ppi'],
                      ['Screen type', 'OLED']
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="text-gray-700">{label}</span>
                        <span className="text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-gray-900">CPU</h3>
                  <div className="space-y-3">
                    {[
                      ['CPU', 'A16 Bionic'],
                      ['Number of cores', '6']
                    ].map(([label, value]) => (
                      <div key={label} className="flex justify-between items-center border-b border-gray-200 pb-2">
                        <span className="text-gray-700">{label}</span>
                        <span className="text-gray-900">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            <button 
              onClick={() => setShowFullDetails(!showFullDetails)}
              className="flex items-center gap-2 px-6 py-3 border border-gray-400 rounded-lg text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span>View More</span>
              <ArrowDownIcon />
            </button>
          </div>
        </section>

        {/* Reviews */}
        <section className="space-y-6">
          <h2 className="text-xl font-medium text-gray-900">Reviews</h2>
          
          {/* Overall Rating */}
          <div className="bg-gray-50 p-6 rounded-xl">
            <div className="flex items-center gap-6">
              <div className="text-center">
                <div className="text-4xl font-medium text-gray-900">4.8</div>
                <div className="text-sm text-gray-500">of 125 reviews</div>
              </div>
              
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <StarFilled key={star} />
                ))}
              </div>
            </div>
          </div>

          {/* Individual Reviews */}
          <div className="space-y-4">
            {reviews.slice(0, showAllReviews ? reviews.length : 2).map((review) => (
              <div key={review.id} className="bg-gray-50 p-4 rounded-lg space-y-3">
                <div className="flex justify-between items-start">
                  <h4 className="font-semibold text-gray-900">{review.name}</h4>
                  <span className="text-sm text-gray-500">{review.date}</span>
                </div>
                
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    star <= review.rating ? <StarFilled key={star} /> : <StarEmpty key={star} />
                  ))}
                </div>
                
                <p className="text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                
                {review.images.length > 0 && (
                  <div className="flex gap-2">
                    {review.images.map((image, index) => (
                      <img 
                        key={index}
                        src={image}
                        alt={`Review ${review.id} image ${index + 1}`}
                        className="w-20 h-16 object-cover rounded"
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {!showAllReviews && reviews.length > 2 && (
            <button 
              onClick={() => setShowAllReviews(true)}
              className="flex items-center gap-2 px-6 py-3 border border-gray-400 rounded-lg text-gray-900 hover:bg-gray-50 transition-colors"
            >
              <span>View More</span>
              <ArrowDownIcon />
            </button>
          )}
        </section>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="space-y-6">
            <h2 className="text-xl font-medium text-gray-900">Related Products</h2>
            
            <div className="grid grid-cols-2 gap-4">
              {relatedProducts.map((relatedProduct) => (
                <ProductCard key={relatedProduct._id} product={relatedProduct} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};