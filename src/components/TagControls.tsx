import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import { db, getCurrentUser } from '../services/firebase';
import { Tag, Plus, X } from 'lucide-react';

interface TagControlsProps {
  phoneNumber: string;
}

const TagControls = ({ phoneNumber }: TagControlsProps) => {
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
    
    const unsubscribe = onSnapshot(chatRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setTags(data.tags || []);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [phoneNumber]);

  const handleAddTag = async () => {
    if (!newTag.trim()) return;

    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      const chatDoc = await getDoc(chatRef);
      
      if (chatDoc.exists()) {
        const currentTags = chatDoc.data().tags || [];
        if (!currentTags.includes(newTag)) {
          await updateDoc(chatRef, {
            tags: [...currentTags, newTag]
          });
        }
      }
      setNewTag('');
      setIsEditing(false);
    } catch (error) {
      console.error('Error adding tag:', error);
    }
  };

  const handleRemoveTag = async (tagToRemove: string) => {
    const userUID = getCurrentUser();
    if (!userUID) return;

    try {
      const chatRef = doc(db, 'Whatsapp_Data', userUID, 'chats', phoneNumber);
      const chatDoc = await getDoc(chatRef);
      
      if (chatDoc.exists()) {
        const currentTags = chatDoc.data().tags || [];
        await updateDoc(chatRef, {
          tags: currentTags.filter(tag => tag !== tagToRemove)
        });
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  if (loading) {
    return <div className="animate-pulse text-xs text-gray-400">Loading...</div>;
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-1">
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag}
                className="inline-flex items-center px-1.5 py-0.5 text-xs bg-gray-100 rounded-full group"
              >
                {tag}
                <button
                  onClick={() => handleRemoveTag(tag)}
                  className="ml-1 text-gray-400 hover:text-gray-600"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
        <button
          onClick={() => setIsEditing(true)}
          className="p-1 text-gray-400 hover:text-gray-600"
          title="Add tag"
        >
          <Tag size={14} />
        </button>
      </div>

      {isEditing && (
        <div className="absolute top-full mt-1 right-0 z-10 bg-white shadow-lg rounded-lg border p-2">
          <div className="flex items-center gap-1">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="Add tag..."
              className="px-2 py-1 text-sm border rounded w-32"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleAddTag();
                }
              }}
              autoFocus
            />
            <button
              onClick={handleAddTag}
              className="p-1 text-blue-500 hover:text-blue-600"
            >
              <Plus size={14} />
            </button>
            <button
              onClick={() => {
                setIsEditing(false);
                setNewTag('');
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TagControls; 