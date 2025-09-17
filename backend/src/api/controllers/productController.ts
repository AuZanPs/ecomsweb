import { Request, Response } from 'express';
import { ProductService } from '../../services/ProductService';
import { AuthRequest } from '../middleware/auth';

export class ProductController {
  getProducts = async (req: Request, res: Response) => {
    try {
      const {
        page = '1',
        limit = '10',
        search,
        minPrice,
        maxPrice,
        sortBy = 'createdAt',
        sortOrder = 'desc'
      } = req.query;

      const validSortBy = ['createdAt', 'name', 'price', 'stock'].includes(sortBy as string) 
        ? sortBy as 'createdAt' | 'name' | 'price' | 'stock'
        : 'createdAt';

      const searchData = {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        query: search as string,
        minPrice: minPrice ? parseFloat(minPrice as string) : undefined,
        maxPrice: maxPrice ? parseFloat(maxPrice as string) : undefined,
        sortBy: validSortBy,
        sortOrder: sortOrder as 'asc' | 'desc'
      };

      const result = await ProductService.getAllProducts(searchData);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getProduct = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { id } = req.params;
      if (!id) {
        return res.status(400).json({ message: 'Product ID is required' });
      }
      const product = await ProductService.getProductById(id);
      if (!product) {
        return res.status(404).json({ message: 'Product not found' });
      }
      return res.json(product);
    } catch (error: any) {
      return res.status(404).json({ message: error.message });
    }
  };

  searchProducts = async (req: Request, res: Response) => {
    try {
      const { query, page = '1', limit = '10' } = req.query;
      
      const searchData = {
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await ProductService.searchProducts(query as string, searchData);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getFeaturedProducts = async (req: Request, res: Response) => {
    try {
      const { limit = '8' } = req.query;
      const products = await ProductService.getFeaturedProducts(parseInt(limit as string));
      res.json(products);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getTopSellingProducts = async (req: Request, res: Response) => {
    try {
      const { limit = '10' } = req.query;
      const products = await ProductService.getTopSellingProducts(parseInt(limit as string));
      res.json(products);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  };

  getProductsByPriceRange = async (req: Request, res: Response): Promise<Response> => {
    try {
      const { minPrice, maxPrice } = req.query;
      if (!minPrice || !maxPrice) {
        return res.status(400).json({ message: 'Both minPrice and maxPrice are required' });
      }
      const products = await ProductService.getProductsByPriceRange(
        parseFloat(minPrice as string),
        parseFloat(maxPrice as string)
      );
      return res.json(products);
    } catch (error: any) {
      return res.status(400).json({ message: error.message });
    }
  };
}