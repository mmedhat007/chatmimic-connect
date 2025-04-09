import React from 'react';

interface ContactContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
}

const ContactContextMenu = React.forwardRef<HTMLDivElement, ContactContextMenuProps>((
  { x, y, onClose, onDelete }, 
  ref
) => {
  const handleOptionClick = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-white rounded-md shadow-lg border border-gray-200 py-1"
      style={{ top: y, left: x }}
    >
      <ul>
        <li 
          className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 cursor-pointer hover:text-red-600"
          onClick={() => handleOptionClick(onDelete)}
        >
          Delete Contact
        </li>
        {/* Add other options here if needed */}
      </ul>
    </div>
  );
});

export default ContactContextMenu; 