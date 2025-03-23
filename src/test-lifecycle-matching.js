// Simple test script to verify lifecycle matching logic

// Test cases for different lifecycle formats
const testCases = [
  { contact: 'hot_lead', filter: 'hot_lead', desc: 'Exact match' },
  { contact: 'Hot_Lead', filter: 'hot_lead', desc: 'Case-insensitive' },
  { contact: 'hot lead', filter: 'hot_lead', desc: 'Spaces vs underscores' },
  { contact: 'Hot Lead', filter: 'hot_lead', desc: 'Case + spaces' },
  { contact: 'hot_lead', filter: 'Hot Lead', desc: 'Filter with spaces and case' },
  { contact: 'HotLead', filter: 'hot_lead', desc: 'No separator in contact' }
];

// Mock stage data similar to what we have in the app
const stageData = { id: 'hot_lead', name: 'Hot Lead' };

// Run tests for each case
console.log('LIFECYCLE MATCHING TESTS:\n');

testCases.forEach(test => {
  console.log(`Test: ${test.desc}`);
  console.log(`Contact lifecycle: "${test.contact}", Filter: "${test.filter}"`);
  
  // 1. Direct match
  const directMatch = test.contact === test.filter;
  console.log(`1. Direct match: ${directMatch}`);
  
  // 2. Case insensitive
  const caseInsensitive = test.contact.toLowerCase() === test.filter.toLowerCase();
  console.log(`2. Case insensitive: ${caseInsensitive}`);
  
  // 3. Normalized (replace underscores with spaces)
  const normalizedContact = test.contact.toLowerCase().replace(/_/g, ' ');
  const normalizedFilter = test.filter.toLowerCase().replace(/_/g, ' ');
  const normalizedMatch = normalizedContact === normalizedFilter;
  console.log(`3. Normalized match: ${normalizedMatch}`);
  
  // 4. Underscores (replace spaces with underscores)
  const contactWithUnderscores = test.contact.toLowerCase().replace(/\s+/g, '_');
  const filterWithUnderscores = test.filter.toLowerCase().replace(/\s+/g, '_');
  const underscoreMatch = contactWithUnderscores === filterWithUnderscores;
  console.log(`4. Underscore match: ${underscoreMatch}`);
  
  // 5. Stage name match
  const stageNameMatch = normalizedContact === stageData.name.toLowerCase();
  console.log(`5. Stage name match: ${stageNameMatch}`);
  
  // 6. Stage ID match
  const stageIdMatch = normalizedContact === stageData.id.toLowerCase().replace(/_/g, ' ');
  console.log(`6. Stage ID match: ${stageIdMatch}`);
  
  // Final result
  const matched = directMatch || caseInsensitive || normalizedMatch || 
                  underscoreMatch || stageNameMatch || stageIdMatch;
  console.log(`RESULT: ${matched ? 'MATCHED ✅' : 'NOT MATCHED ❌'}`);
  console.log('-----------------------------------\n');
}); 