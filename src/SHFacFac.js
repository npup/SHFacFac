/*
*   SHFacFac - Storage Handler Factory Factory!
*   Returns a factory for Storage Handlers
*/
function SHFacFac(global, ns) {
    var moduleName = arguments.callee.name;
    // Fail early..
    if (!global.localStorage) throw new Error(barf('Browser environment has no support for localStorage'));

    var Local = global.localStorage, Session;
    /* Try/catch to save from error when referencing sessionStorage using "file://" protocol in Firefox */
    try {Session = global.sessionStorage;} catch(err) {}
    
    // Return function that can create a Local Storage Handler
    return (function SHFac(global, ns) {
        var name = ns, factoryPrefix = '_'+moduleName.toLowerCase()+'_'+name.toLowerCase()+'_';
        
        // Create an object store (only used from the "create" function in the API)
        function Store(clazz, options) {
            var self = this;
            self._internal = {};
            options = options || {};
            self._internal.clazz  = clazz;
            self._internal.clazzName = clazz.prototype.constructor.name;
            var defaultOptions = {
                prefix: self._internal.clazzName.toLowerCase()
                , session: false
            };
            for (var p in defaultOptions) {
                if (!(p in options)) options[p] = defaultOptions[p];
            }
            self._internal.Storage = options.session ? Session : Local;
            if (!self._internal.Storage) {throw new Error(barf(self.clazzName+'::Could not obtain reference to storage object ('+(options.session?'session':'local')+'). Using Firefox and "file://" protocol?'));}
            self._internal.NS = '_'+ns+'-data';
            self._internal.PREFIX = getPrefix(moduleName, ns, options);
            self._internal.prop = {
                id: self._internal.PREFIX+'id'
                , created: self._internal.PREFIX+'createdDate'
                , saved: self._internal.PREFIX+'savedDate'
            };
            self['info'] = function (obj, prop) {
                return {
                    id: obj[self._internal.NS].id
                    , created: obj[self._internal.NS].createdDate
                    , saved: obj[self._internal.NS].savedDate
                }[prop];
            };
        }
        function getPrefix(moduleName, ns, options) {
            return factoryPrefix+options.prefix+'-';
        }


        /*
        * Store an object.
        *   Parameters:
        *       obj     - object to store. Must be an instance of the type handled by this store
        *
        *   Returns: id the object was stored under
        */
        Store.prototype.store = function (obj) {
            if (!(obj instanceof this._internal.clazz)) throw new Error(barf('Could not store object of type '+(obj.constructor ? obj.constructor.name : typeof object)+' via this store (should be type '+this._internal.clazzName+')'));
            var ts = (+(new Date)).toString(16);
            var data = obj[this._internal.NS], id, created, saved;
            if (typeof data === 'undefined') {
                // Build the custom data and inject it
                id = this._internal.prop.id+'-'+ts;
                created = saved = ts;
                obj[this._internal.NS] = {
                    id: id
                    , created: created
                    , saved: saved
                };
            }
            else {
                // Update custom data before re-saving
                id = obj[this._internal.NS].id;
                obj[this._internal.NS].saved = ts;
            }
            if (typeof id==='undefined') throw new Error(barf('Could not obtain an id to save object.'));
    
            // Temporarily remove date objects during saving
            delete obj[this._internal.NS].createdDate;
            delete obj[this._internal.NS].savedDate;
            saveToStore(this, id, obj);
            // Restore the date objects
            obj[this._internal.NS].createdDate = new Date(parseInt(obj[this._internal.NS].created, 16));
            obj[this._internal.NS].savedDate = new Date(parseInt(obj[this._internal.NS].saved, 16));
            return id;
        };

        /*
        * Retrieve an object by id
        *   Parameters:
        *       id  - string, id of object to retrieve
        *
        *   Ret
        */
        Store.prototype.retrieve = function (id) {
            var obj = retrieveFromStore(this, id); // get plain js obj
            if (obj) {
                // Restore date objects from the stamps
                obj[this._internal.NS].createdDate = new Date(parseInt(obj[this._internal.NS].created, 16));
                obj[this._internal.NS].savedDate = new Date(parseInt(obj[this._internal.NS].saved, 16));
                // Restore prototype for instanceof jazz etc
                obj.__proto__ = this._internal.clazz.prototype;
            }
            return obj;
        };

        /*
        * Remove an object from store (also removes the custom data)
        *   Parameters:
        *       item    - obj of handled type, or string (id for obj of handled type)
        */
        Store.prototype.remove = function (item) {
            var obj, id, check;
            if (typeof item==='string') {
                check = item.replace(this._internal.prop.id, '');
                if (check.charAt(0)!=='-') {throw new Error(barf(this._internal.clazzName+'::Remove by id failed for invalid id ('+item+')'));}
                obj = this.retrieve(item);
            }
            else if (item instanceof this.clazz) {
                obj = item;
            }
            if (!obj) return;
            id = obj[this._internal.NS].id;
            // Remove object from store
            removeFromStore(this, id);
            // Remove custom data from object
            delete obj[this._internal.NS];
            return obj;
        };

        /*
        * Retrieve array of stored objects 
        *   Parameters:
        *       options - optional hash of options:
        *           "sortKey"   - property to sort on
        *           "dir"       - string, sort direction (asc|desc), defaults to 'asc'
        */
        Store.prototype.list = function (options) {
            var list = [], orderBy, customNS, key;
            for (var idx=0, len=this._internal.Storage.length; idx<len; ++idx) {
                key = this._internal.Storage.key(idx);
                if (key.indexOf(this._internal.prop.id)===0) list.push(this.retrieve(key));
            }
            if (options && options.orderBy) {
                orderBy = options.orderBy;
                // If needed, look in the custom props obj for the comparison
                if (orderBy in this._internal.prop) customNS = this._internal.NS;
                (new Sorter({orderBy:orderBy, dir: options.dir, customNS: customNS})).sort(list);
            }
            return list;
        };

        /*
        * Returns the nr of objects in store
        */
        Store.prototype.count = function () {
            return this.list().length;
        };

        /*
        * Clear store from objects (objects are cleared of custom data)
        * Returns the nr of removed objects
        */
        Store.prototype.clear = function () {
            var count = 0;
            for (var itemId in Storage) {
                if (itemId.indexOf(this._internal.prop.id)===0) {
                    removeFromStore(this, itemId);
                    ++count;
                }
            }
            return count;
        };
                
        function saveToStore(store, id, obj) {
            //global.console.debug('%s::%s::%s,  STORING obj with id [%s]', moduleName, ns, store.clazzName, id);
            store._internal.Storage.setItem(id, JSON.stringify(obj));
        }
        function retrieveFromStore(store, id) {
            //global.console.debug('%s::%s::%s,  RETRIEVING obj with id [%s]', moduleName, ns, store.clazzName, id);
            return JSON.parse(store._internal.Storage.getItem(id));
        }
        function removeFromStore(store, id) {
            //global.console.debug('%s::%s::%s, REMOVING obj with id [%s]', moduleName, ns, store.clazzName, id);
            store.Storage.removeItem(id);
        }

        // Sorting function builder (only called from the "list" function on the object handler)
        function Sorter(options) {
            this.orderBy = options.orderBy;
            this.desc = options.dir==='desc';
            options.customNS && (this.customNS = options.customNS);
        }
        Sorter.prototype.sort = function (arr) {
            var self = this, temp;
            arr.sort(function (o1, o2) {
                // Switch objs if sorting desc
                if (self.desc) {
                    temp = o1;
                    o1 = o2;
                    o2 = temp;
                }
                // Check on props in subObject, if given
                if (self.customNS) {
                    o1 = o1[self.customNS];
                    o2 = o2[self.customNS];
                }
                var v1 = o1[self.orderBy]; v2 = o2[self.orderBy];
                return v1 > v2;
            });
        };

        // The API of a Storage Handler Factory
        var API = {
            /**
            * Obtain a Storage Handler
            *   Parameters:
            *       clazz   - constructor function of the objects handled by the store
            *       options - optional hash of options:
            *           "prefix"    - string, defaults to the classname, lowercased
            *           "session"   - boolean, defaults to false. Says if sessionStorage should be used
            */
            createStore: function (clazz, options) {
                return new Store(clazz, options);
            }
            , getName: function () {
                return name;
            }
            , getPrefix: function () {
                return factoryPrefix;
            }
        };

        // Export API
        return API;

    })(global, ns);
    
    // Centralized error msg builder
    function barf(msg) {
        return moduleName+'::'+ns+'::'+msg;
    }
}
