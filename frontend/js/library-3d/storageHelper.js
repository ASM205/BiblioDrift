
export const StorageHelper = {
    get: function(key) {
        return typeof SafeStorage !== 'undefined' ? SafeStorage.get(key) : localStorage.getItem(key);
    },
    set: function(key, value) {
        if (typeof SafeStorage !== 'undefined') {
            SafeStorage.set(key, value);
        } else {
            localStorage.setItem(key, value);
        }
    }
};

// Action to cache or remove book from local IndexedDB
