// A statement snippet must not add a second namespace or become a member access.
export function contextualSnippet(language,before,insertText){
 if(!['cpp','c++'].includes(language))return insertText;
 if(/(?:^|[^\w:])(?:::)?std\s*::\s*$/.test(before))return insertText.startsWith('std::')?insertText.slice(5):null;
 if(/(?:::|\.|->)\s*$/.test(before))return null;
 return insertText;
}
