import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import { 
  getAllLifecycleTagConfigs, 
  saveLifecycleTagConfig,
  deleteLifecycleTagConfig,
  getAvailableLifecycleStages,
  LifecycleTagConfig
} from '../services/lifecycleTagging';
import { Loader2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Switch } from './ui/switch';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

const LifecycleTaggingConfig: React.FC = () => {
  const navigate = useNavigate();
  const [configs, setConfigs] = useState<LifecycleTagConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<LifecycleTagConfig | null>(null);
  const [availableStages] = useState<string[]>(getAvailableLifecycleStages());

  // Form state
  const [name, setName] = useState('');
  const [keywords, setKeywords] = useState('');
  const [active, setActive] = useState(true);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const fetchedConfigs = await getAllLifecycleTagConfigs();
      setConfigs(fetchedConfigs);
    } catch (error) {
      console.error('Error fetching lifecycle tag configs:', error);
      toast.error('Failed to load lifecycle tagging configurations');
    } finally {
      setLoading(false);
    }
  };

  const handleNewConfig = () => {
    setEditingConfig(null);
    setName('');
    setKeywords('');
    setActive(true);
    setDialogOpen(true);
  };

  const handleEditConfig = (config: LifecycleTagConfig) => {
    setEditingConfig(config);
    setName(config.name);
    setKeywords(config.keywords.join(', '));
    setActive(config.active);
    setDialogOpen(true);
  };

  const handleSaveConfig = async () => {
    try {
      if (!name) {
        toast.error('Please select a lifecycle stage');
        return;
      }

      const keywordArray = keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (keywordArray.length === 0) {
        toast.error('Please add at least one keyword');
        return;
      }

      const configToSave: LifecycleTagConfig = {
        id: editingConfig?.id,
        name,
        keywords: keywordArray,
        active
      };

      await saveLifecycleTagConfig(configToSave);
      setDialogOpen(false);
      toast.success(`Lifecycle tagging rule ${editingConfig ? 'updated' : 'created'} successfully`);
      fetchConfigs();
    } catch (error) {
      console.error('Error saving lifecycle config:', error);
      toast.error('Failed to save lifecycle tagging rule');
    }
  };

  const handleDeleteConfig = async (configId: string) => {
    try {
      await deleteLifecycleTagConfig(configId);
      toast.success('Lifecycle tagging rule deleted');
      fetchConfigs();
    } catch (error) {
      console.error('Error deleting lifecycle config:', error);
      toast.error('Failed to delete lifecycle tagging rule');
    }
  };

  const toggleConfigActive = async (config: LifecycleTagConfig) => {
    try {
      const updatedConfig = {
        ...config,
        active: !config.active
      };
      await saveLifecycleTagConfig(updatedConfig);
      toast.success(`Rule for "${config.name}" ${!config.active ? 'activated' : 'deactivated'}`);
      fetchConfigs();
    } catch (error) {
      console.error('Error toggling lifecycle config:', error);
      toast.error('Failed to update rule status');
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Lifecycle Tagging Rules</h1>
        <Button onClick={handleNewConfig}>Add New Rule</Button>
      </div>
      
      {loading ? (
        <div className="flex justify-center items-center h-40">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : configs.length === 0 ? (
        <div className="text-center p-10 border rounded-lg bg-background">
          <h3 className="text-xl font-semibold mb-2">No Lifecycle Tagging Rules</h3>
          <p className="text-muted-foreground mb-4">
            Create rules to automatically tag contacts based on message content.
          </p>
          <Button onClick={handleNewConfig}>Create Your First Rule</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {configs.map((config) => (
            <Card key={config.id} className={!config.active ? "opacity-70" : ""}>
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle className="capitalize">{config.name}</CardTitle>
                  <Switch 
                    checked={config.active} 
                    onCheckedChange={() => toggleConfigActive(config)}
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <Label>Keywords</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {config.keywords.map((keyword, index) => (
                        <span 
                          key={index} 
                          className="bg-secondary text-secondary-foreground px-2 py-1 rounded-md text-sm"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEditConfig(config)}
                >
                  Edit
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  onClick={() => handleDeleteConfig(config.id!)}
                >
                  Delete
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingConfig ? 'Edit Lifecycle Tagging Rule' : 'Create Lifecycle Tagging Rule'}
            </DialogTitle>
            <DialogDescription>
              Define keywords that will automatically update a contact's lifecycle stage.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="lifecycle">Lifecycle Stage</Label>
              <Select
                value={name}
                onValueChange={setName}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a lifecycle stage" />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      <span className="capitalize">{stage.replace(/_/g, ' ')}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords (comma separated)</Label>
              <Textarea
                id="keywords"
                placeholder="interested, pricing, details, cost"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
              />
              <p className="text-sm text-muted-foreground">
                Add keywords that indicate this lifecycle stage when found in messages.
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Switch 
                id="active" 
                checked={active} 
                onCheckedChange={setActive}
              />
              <Label htmlFor="active">Active</Label>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveConfig}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LifecycleTaggingConfig; 