export const categoryOptions = [
    { value: '', label: 'Any Category' },
    { value: 'general_knowledge', label: 'General Knowledge' },
    { value: 'film_and_tv', label: 'Film & TV' },
    { value: 'music', label: 'Music' },
    { value: 'science', label: 'Science' },
    { value: 'history', label: 'History' },
    { value: 'sport_and_leisure', label: 'Sport & Leisure' },
    { value: 'geography', label: 'Geography' },
    { value: 'arts_and_literature', label: 'Arts & Literature' },
    { value: 'society_and_culture', label: 'Society & Culture' },
    { value: 'food_and_drink', label: 'Food & Drink' },
];

const categoryLabels = new Map(categoryOptions.map(({ value, label }) => [value, label]));
export function formatCategory(category?: string) {
    if (!category) return 'Mixed';
    return categoryLabels.get(category.toLowerCase().replace(/ /g, '_')) ?? category.replace(/[_-]/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
}
