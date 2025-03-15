import { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/firebase';
import {
  addToKnowledgeBase,
  searchKnowledgeBase,
  deleteFromKnowledgeBase,
  updateKnowledgeBaseItem
} from '../services/embeddings';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";

interface KnowledgeBaseItem {
  id: number;
  content: string;
  metadata: {
    source: string;
    type: 'faq' | 'product' | 'policy' | 'scenario';
    category?: string;
  };
  created_at: string;
}

const KnowledgeBase = () => {
  const { toast } = useToast();
  const [items, setItems] = useState<KnowledgeBaseItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [newItem, setNewItem] = useState({
    content: '',
    source: '',
    type: 'faq' as const,
    category: ''
  });
  const [editingItem, setEditingItem] = useState<KnowledgeBaseItem | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const userUID = getCurrentUser();

  const handleSearch = async () => {
    if (!userUID || !searchQuery.trim()) return;

    setIsLoading(true);
    try {
      const results = await searchKnowledgeBase(
        userUID,
        searchQuery,
        selectedType as any,
        10
      );
      setItems(results);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to search knowledge base",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!userUID || !newItem.content.trim() || !newItem.source.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      await addToKnowledgeBase(userUID, newItem.content, {
        source: newItem.source,
        type: newItem.type,
        category: newItem.category || undefined
      });

      setNewItem({
        content: '',
        source: '',
        type: 'faq',
        category: ''
      });

      toast({
        title: "Success",
        description: "Item added to knowledge base",
      });

      // Refresh search results if there's an active search
      if (searchQuery) {
        await handleSearch();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add item",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async () => {
    if (!userUID || !editingItem) return;

    setIsLoading(true);
    try {
      await updateKnowledgeBaseItem(
        userUID,
        editingItem.id,
        editingItem.content,
        editingItem.metadata
      );

      setEditingItem(null);
      toast({
        title: "Success",
        description: "Item updated successfully",
      });

      // Refresh search results
      if (searchQuery) {
        await handleSearch();
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update item",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!userUID) return;

    setIsLoading(true);
    try {
      await deleteFromKnowledgeBase(userUID, id);
      setItems(items.filter(item => item.id !== id));
      toast({
        title: "Success",
        description: "Item deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Search Knowledge Base</h3>
        <div className="flex gap-4">
          <Input
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1"
          />
          <Select
            value={selectedType}
            onValueChange={setSelectedType}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All Types</SelectItem>
              <SelectItem value="faq">FAQ</SelectItem>
              <SelectItem value="product">Product</SelectItem>
              <SelectItem value="policy">Policy</SelectItem>
              <SelectItem value="scenario">Scenario</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleSearch} disabled={isLoading}>
            Search
          </Button>
        </div>
      </Card>

      {/* Add New Item Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Add New Item</h3>
        <div className="space-y-4">
          <Textarea
            placeholder="Content"
            value={newItem.content}
            onChange={(e) => setNewItem({ ...newItem, content: e.target.value })}
          />
          <div className="flex gap-4">
            <Input
              placeholder="Source"
              value={newItem.source}
              onChange={(e) => setNewItem({ ...newItem, source: e.target.value })}
              className="flex-1"
            />
            <Select
              value={newItem.type}
              onValueChange={(value: any) => setNewItem({ ...newItem, type: value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="faq">FAQ</SelectItem>
                <SelectItem value="product">Product</SelectItem>
                <SelectItem value="policy">Policy</SelectItem>
                <SelectItem value="scenario">Scenario</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Input
            placeholder="Category (optional)"
            value={newItem.category}
            onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
          />
          <Button onClick={handleAdd} disabled={isLoading}>
            Add Item
          </Button>
        </div>
      </Card>

      {/* Results Section */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Knowledge Base Items</h3>
        <div className="space-y-4">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              {editingItem?.id === item.id ? (
                <div className="space-y-4">
                  <Textarea
                    value={editingItem.content}
                    onChange={(e) => setEditingItem({
                      ...editingItem,
                      content: e.target.value
                    })}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleUpdate} disabled={isLoading}>
                      Save
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setEditingItem(null)}
                      disabled={isLoading}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-600 mb-2">
                    {item.metadata.type.toUpperCase()} - {item.metadata.source}
                    {item.metadata.category && ` - ${item.metadata.category}`}
                  </p>
                  <p className="mb-4">{item.content}</p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditingItem(item)}
                      disabled={isLoading}
                    >
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleDelete(item.id)}
                      disabled={isLoading}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default KnowledgeBase; 