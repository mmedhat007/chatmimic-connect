# Database Migration Guide

This document provides instructions on how to migrate and update the ChatMimic Connect database structure.

## Overview

ChatMimic Connect uses a dual-database architecture with Firebase (Firestore) for real-time data and Supabase (PostgreSQL) for vector embeddings and configuration storage. This guide covers migration procedures for both databases.

## Firebase Migrations

### Adding New Fields to Collections

When adding new fields to existing Firestore collections:

1. **Update the client code** to handle both the presence and absence of the field
2. **Use default values** when reading documents that may not have the new field:

```javascript
// Reading a document with a potentially missing field
const data = doc.data();
const newField = data.newField || defaultValue;
```

3. **Batch update existing documents** if necessary:

```javascript
const batch = firebase.firestore().batch();
const snapshot = await firebase.firestore().collection('collectionName').get();

snapshot.docs.forEach(doc => {
  batch.update(doc.ref, { newField: defaultValue });
});

await batch.commit();
```

### Changing Field Types

When changing the type of a field:

1. **Create a conversion function** to handle the transformation:

```javascript
function convertField(oldValue) {
  // Convert from old type to new type
  return newValue;
}
```

2. **Batch update documents** to change the field type:

```javascript
const batch = firebase.firestore().batch();
const snapshot = await firebase.firestore().collection('collectionName').get();

snapshot.docs.forEach(doc => {
  const data = doc.data();
  batch.update(doc.ref, { 
    fieldName: convertField(data.fieldName) 
  });
});

await batch.commit();
```

### Restructuring Collections

When restructuring collections (e.g., moving fields to subcollections):

1. **Export existing data** first:

```javascript
const snapshot = await firebase.firestore().collection('oldCollection').get();
const data = snapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
fs.writeFileSync('backup.json', JSON.stringify(data, null, 2));
```

2. **Create a migration script** to move data to the new structure
3. **Update client code** to use the new structure before deploying
4. **Run the migration** in a controlled environment

## Supabase Migrations

### Adding New Columns

When adding new columns to existing tables:

```sql
-- Add a new column to a specific user table
DO $$
DECLARE
  user_ids TEXT[] := ARRAY['user1', 'user2', 'user3']; -- Add your user IDs
  user_id TEXT;
  sanitized_uid TEXT;
  table_name TEXT;
BEGIN
  FOREACH user_id IN ARRAY user_ids LOOP
    sanitized_uid := MD5(user_id);
    table_name := 'user_table_' || sanitized_uid;
    
    -- Check if the column exists
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = table_name
      AND column_name = 'new_column'
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN new_column TEXT', table_name);
    END IF;
  END LOOP;
END $$;
```

### Modifying Vector Dimensions

If changing the embedding model results in different vector dimensions:

1. **Create new tables** with the updated vector dimensions:

```sql
CREATE OR REPLACE FUNCTION create_user_embedding_table_new_dim(uid TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    sanitized_uid TEXT;
    table_exists BOOLEAN;
    user_embeddings_table_name TEXT;
BEGIN
    sanitized_uid := MD5(uid);
    user_embeddings_table_name := 'user_embeddings_new_' || sanitized_uid;
    
    -- Check if table already exists
    SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = user_embeddings_table_name
    ) INTO table_exists;
    
    IF NOT table_exists THEN
        -- Create embeddings table with new dimensions
        EXECUTE format('
            CREATE TABLE %I (
                id SERIAL PRIMARY KEY,
                content TEXT,
                embedding VECTOR(1536), -- Update dimension as needed
                query_name TEXT,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        ', user_embeddings_table_name);
        
        -- Create index on embeddings for similarity search
        EXECUTE format('
            CREATE INDEX ON %I 
            USING ivfflat (embedding vector_cosine_ops)
            WITH (lists = 100)
        ', user_embeddings_table_name);
        
        RETURN TRUE;
    ELSE
        RETURN FALSE;
    END IF;
END;
$$;
```

2. **Regenerate embeddings** and store them in the new tables
3. **Switch to the new tables** once migration is complete
4. **Drop old tables** after verifying the new ones work correctly

### Updating SQL Functions

When updating SQL functions:

```sql
-- Drop the existing function
DROP FUNCTION IF EXISTS function_name(parameter_types);

-- Create the updated function
CREATE OR REPLACE FUNCTION function_name(parameters)
RETURNS return_type
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Updated function body
END;
$$;
```

## Migration Checklist

Before performing any migration:

1. **Create a complete backup** of both databases
2. **Test the migration** in a development environment
3. **Plan for downtime** if necessary
4. **Prepare rollback scripts** in case of issues
5. **Update client code** to be compatible with both old and new structures
6. **Document all changes** for future reference

## Post-Migration Verification

After migration:

1. **Verify data integrity** by comparing record counts and sampled data
2. **Test critical functionality** to ensure it works with the new structure
3. **Monitor error rates** for any increase after the migration
4. **Perform performance testing** to ensure no degradation

## Common Pitfalls

- **Missing Indexes**: When adding columns that will be queried frequently, add appropriate indexes
- **Transaction Limits**: Firestore has limits on batch sizes (500 operations) - split large migrations
- **Client Compatibility**: Ensure all client versions can handle the new structure
- **Permission Issues**: Functions may need SECURITY DEFINER to operate correctly
- **Data Type Conversion**: Be careful when changing data types to avoid truncation or precision loss

## Emergency Rollback

If a migration fails and you need to roll back:

1. **Restore from backup** if data was corrupted
2. **Revert schema changes** using prepared rollback scripts
3. **Revert client code** to the compatible version
4. **Document the issue** for future attempts 