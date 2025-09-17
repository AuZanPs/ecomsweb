import { Link } from 'react-router-dom';

// Figma design system assets (main banner section)
const imgIphoneImage = "http://localhost:3845/assets/20ae4cc7d95ed194279d337796d951679b146d4a.png";

// Button component from Figma design system
interface ButtonProps {
  buttonText?: string;
  state?: "Small Stroke" | "White Stroke" | "Fill" | "Black Stroke" | "Fill Small" | "Stroke Small";
  onClick?: () => void;
  className?: string;
}

function Button({ buttonText = "Label", state = "White Stroke", onClick, className = "" }: ButtonProps) {
  const baseClasses = "box-border content-stretch flex gap-[8px] items-center justify-center relative rounded-[6px] cursor-pointer transition-colors";
  
  let stateClasses = "";
  switch (state) {
    case "Fill Small":
      stateClasses = "bg-black text-white px-[64px] py-[12px] text-[14px] rounded-[8px]";
      break;
    case "Black Stroke":
      stateClasses = "border border-black border-solid text-black px-[56px] py-[16px] text-[16px]";
      break;
    case "Fill":
      stateClasses = "bg-black text-white px-[56px] py-[16px] text-[16px]";
      break;
    default:
      stateClasses = "border border-solid border-white text-white px-[56px] py-[16px] text-[16px]";
  }

  return (
    <button
      className={`${baseClasses} ${stateClasses} ${className}`}
      onClick={onClick}
    >
      <span className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic text-center text-nowrap">
        {buttonText}
      </span>
    </button>
  );
}

export default function HomePage() {
  return (
    <div className="bg-neutral-50 relative w-full">
      {/* Hero Banner Section - Based on Figma main banner */}
      <div className="relative bg-[#211c24] content-center flex flex-wrap gap-[24px] items-center justify-between left-1/2 overflow-clip px-[160px] py-[80px] translate-x-[-50%] w-[1440px]">
        <div className="basis-0 content-stretch flex flex-col gap-[24px] grow items-start justify-start min-h-px min-w-[400px] relative shrink-0">
          <div className="content-stretch flex flex-col gap-[24px] items-start justify-start leading-[0] relative shrink-0 text-white w-full">
            <div className="font-['Figtree:SemiBold',_sans-serif] font-semibold opacity-40 relative shrink-0 text-[25px] w-full">
              <p className="leading-[32px]">Pro.Beyond.</p>
            </div>
            <div className="font-['SF_Pro_Display:Thin',_sans-serif] not-italic relative shrink-0 text-[0px] tracking-[-0.96px] w-full">
              <p className="leading-[72px] text-[96px]">
                <span>IPhone 14 </span>
                <span className="font-['SF_Pro_Display:Semibold',_sans-serif] not-italic">Pro</span>
              </p>
            </div>
          </div>
          <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] min-w-full not-italic relative shrink-0 text-[#909090] text-[18px]" style={{ width: "min-content" }}>
            <p className="leading-[24px]">Created to change everything for the better. For everyone</p>
          </div>
          <Link to="/products">
            <Button buttonText="Shop Now" state="White Stroke" />
          </Link>
        </div>
        <div className="h-[632px] relative shrink-0 w-[406px]">
          <div className="absolute bg-center bg-cover bg-no-repeat bottom-[-439px] h-[998px] right-0 w-[406px]" style={{ backgroundImage: `url('${imgIphoneImage}')` }} />
        </div>
      </div>

      {/* Quick Categories Section */}
      <div className="bg-white content-stretch flex flex-col gap-[32px] items-start justify-start px-[160px] py-[80px] relative w-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic relative text-[24px] text-black tracking-[0.24px]">
            <p className="leading-[32px]">Browse By Category</p>
          </div>
        </div>
        
        <div className="content-start flex flex-wrap gap-[32px] items-start justify-start relative w-full">
          {[
            { name: 'Phones', count: '250+ products', to: '/products?category=phones' },
            { name: 'Computers', count: '150+ products', to: '/products?category=computers' },
            { name: 'Smart Watches', count: '80+ products', to: '/products?category=smartwatches' },
            { name: 'Cameras', count: '120+ products', to: '/products?category=cameras' },
            { name: 'Headphones', count: '200+ products', to: '/products?category=headphones' },
            { name: 'Gaming', count: '180+ products', to: '/products?category=gaming' }
          ].map((category, index) => (
            <Link
              key={index}
              to={category.to}
              className="bg-[#ededed] box-border content-stretch flex flex-col gap-[8px] h-[128px] items-center justify-center min-w-[135px] px-[52px] py-[24px] relative rounded-[15px] shrink-0 w-[160px] hover:bg-[#dcdcdc] transition-colors cursor-pointer"
            >
              <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic relative text-[16px] text-black text-center text-nowrap">
                <p className="leading-[24px]">{category.name}</p>
              </div>
              <div className="font-['SF_Pro_Display:Regular',_sans-serif] leading-[0] not-italic relative text-[12px] text-[#909090] text-center text-nowrap">
                <p className="leading-[16px]">{category.count}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Featured Products Section */}
      <div className="bg-neutral-50 content-stretch flex flex-col gap-[32px] items-start justify-start px-[160px] py-[80px] relative w-full">
        <div className="content-stretch flex items-center justify-between relative w-full">
          <div className="font-['SF_Pro_Display:Medium',_sans-serif] leading-[0] not-italic relative text-[24px] text-black tracking-[0.24px]">
            <p className="leading-[32px]">Featured Products</p>
          </div>
          <Link to="/products">
            <Button buttonText="View All" state="Black Stroke" />
          </Link>
        </div>
        
        <div className="content-start flex flex-wrap gap-[16px] items-start justify-start relative w-full">
          {[
            { name: 'Apple iPhone 14 Pro Max', price: '$1399', image: 'iphone' },
            { name: 'MacBook Pro 16"', price: '$2499', image: 'macbook' },
            { name: 'AirPods Pro', price: '$249', image: 'airpods' },
            { name: 'Apple Watch Series 9', price: '$399', image: 'watch' }
          ].map((product, index) => (
            <div
              key={index}
              className="basis-0 bg-[#f6f6f6] box-border content-stretch flex flex-col gap-[16px] grow items-center justify-start min-h-px min-w-[200px] px-[16px] py-[24px] relative rounded-[9px] shrink-0"
            >
              <div className="bg-neutral-200 h-[160px] relative rounded-[8px] w-[160px]">
                {/* Placeholder for product image */}
              </div>
              <div className="content-stretch flex flex-col gap-[16px] items-start justify-start leading-[0] not-italic relative text-black text-center w-full">
                <div className="font-['SF_Pro_Display:Medium',_sans-serif] relative text-[16px] w-full">
                  <p className="leading-[24px]">{product.name}</p>
                </div>
                <div className="font-['SF_Pro_Display:Semibold',_sans-serif] relative text-[24px] tracking-[0.72px] w-full">
                  <p className="leading-[24px]">{product.price}</p>
                </div>
              </div>
              <Link to="/products" className="w-full">
                <Button buttonText="View Product" state="Fill Small" className="w-full" />
              </Link>
            </div>
          ))}
        </div>
      </div>

      {/* Call to Action Section */}
      <div className="bg-black content-stretch flex flex-col gap-[32px] items-center justify-center px-[160px] py-[80px] relative text-center text-white w-full">
        <div className="content-stretch flex flex-col gap-[16px] items-center justify-start leading-[0] relative text-center w-full">
          <div className="font-['SF_Pro_Display:Semibold',_sans-serif] relative text-[32px] w-full">
            <p className="leading-[40px]">Ready to Start Shopping?</p>
          </div>
          <div className="font-['SF_Pro_Display:Regular',_sans-serif] relative text-[18px] text-[#909090] w-full">
            <p className="leading-[24px]">Discover amazing products at unbeatable prices</p>
          </div>
        </div>
        <div className="flex gap-[16px] items-center justify-center">
          <Link to="/products">
            <Button buttonText="Browse Products" state="White Stroke" />
          </Link>
          <Link to="/auth">
            <Button buttonText="Sign Up Today" state="Fill" className="bg-white text-black border-white" />
          </Link>
        </div>
      </div>
    </div>
  );
}