/*
*	SHFacFac - Storage Handler Factory Factory!
*	Returns a factory for Storage Handlers
*/
function SHFacFac(global, ns) {
	var moduleName = arguments.callee.name;
	// Fail early..
	if (!global.localStorage) throw new Error(barf('Browser environment has no support for localStorage'));
	
	var Local = global.localStorage, Session;
	/* Try/catch to save from error when referencing sessionStorage using "file://" protocol in Firefox */
	try {Session = global.sessionStorage;} catch(err) {}
	
	// Return function that can create a Local Storage Handler
	return (function SHFac(global, ns) {ter
		// Create an object store (only used from the "create" function in the API)
		function Store(clazz, options) {
			options = options || {}, self = this;
			self.clazz = clazz;
			self.clazzName = clazz.prototype.constructor.name;
			var defaultOptions = {
				prefix: self.clazzName.toLowerCase()
				, session: false
			};
			for (var p in defaultOptions) {
				if (!(p in options)) options[p] = defaultOptions[p];
			}
			this.Storage = options.session ? Session : Local;
			if (!this.Storage) {throw new Error(barf(this.clazzName+'::Could not obtain reference to storage object ('+(options.session?'session':'local')+'). Using Firefox and "file://" protocol?'));}
			self.NS = '_'+ns+'-data';
			self.PREFIX = '_'+moduleName.toLowerCase()+'_'+ns.toLowerCase()+'_'+options.prefix+'-';
			self.prop = {
				id: self.PREFIX+'id'
				, created: self.PREFIX+'createdDate'
				, saved: self.PREFIX+'savedDate'
			};
			self['info'] = function (obj, prop) {
				return {
					id: obj[self.NS].id
					, created: obj[self.NS].createdDate
					, saved: obj[self.NS].savedDate
				}[prop];
			};
		}


		/*
		* Store an object.
		*	Parameters:
		*		obj		- object to store. Must be an instance of the type handled by this store
		*
		*	Returns: id the object was stored under
		*/
		Store.prototype.store = function (obj) {
			if (!(obj instanceof this.clazz)) throw new Error(barf('Could not store object of type '+(obj.constructor ? obj.constructor.name : typeof object)+' via this store (should be type '+this.clazzName+')'));
			var ts = (+(new Date)).toString(16);
			var data = obj[this.NS], id, created, saved;
			if (typeof data === 'undefined') {
				// Build the custom data and inject it
				id = this.prop.id+'-'+ts;
				created = saved = ts;
				obj[this.NS] = {
					id: id
					, created: created
					, saved: saved
				};
			}
			else {
				// Update custom data before re-saving
				id = obj[this.NS].id;
				obj[this.NS].saved = ts;
			}
			if (typeof id==='undefined') throw new Error(barf('Could not obtain an id to save object.'));
	
			// Temporarily remove date objects during saving
			delete obj[this.NS].createdDate;
			delete obj[this.NS].savedDate;
			saveToStore(this, id, obj);
			// Restore the date objects
			obj[this.NS].createdDate = new Date(parseInt(obj[this.NS].created, 16));
			obj[this.NS].savedDate = new Date(parseInt(obj[this.NS].saved, 16));
			return id;
		};

		/*
		* Retrieve an object by id
		*	Parameters:
		*		id	- string, id of object to retrieve
		*
		*	Ret
		*/
		Store.prototype.retrieve = function (id) {
			var obj = retrieveFromStore(this, id); // get plain js obj
			if (obj) {
				// Restore date objects from the stamps
				obj[this.NS].createdDate = new Date(parseInt(obj[this.NS].created, 16));
				obj[this.NS].savedDate = new Date(parseInt(obj[this.NS].saved, 16));
				// Restore prototype for instanceof jazz etc
				obj.__proto__ = this.clazz.prototype;
			}
			return obj;
		};

		/*
		* Remove an object from store (also removes the custom data)
		*	Parameters:
		*		item	- obj of handled type, or string (id for obj of handled type)
		*/
		Store.prototype.remove = function (item) {
			var obj, id, check;
			if (typeof item==='string') {
				check = item.replace(this.prop.id, '');
				if (check.charAt(0)!=='-') {throw new Error(barf(this.clazzName+'::Remove by id failed for invalid id ('+item+')'));}
				obj = this.retrieve(item);
			}
			else if (item instanceof this.clazz) {
				obj = item;
			}
			if (!obj) return;
			id = obj[this.NS].id;
			// Remove object from store
			removeFromStore(this, id);
			// Remove custom data from object
			delete obj[this.NS];
			return obj;
		};

		/*
		* Retrieve array of stored objects 
		*	Parameters:
		*		options - optional hash of options:
		*			"sortKey"	- property to sort on
		*			"dir"		- string, sort direction (asc|desc), defaults to 'asc'
		*/
		Store.prototype.list = function (options) {
			var list = [], orderBy, customNS, key;
			for (var idx=0, len=this.Storage.length; idx<len; ++idx) {
				key = this.Storage.key(idx);
				if (key.indexOf(this.prop.id)===0) list.push(this.retrieve(key));
			}
			if (options && options.orderBy) {
				orderBy = options.orderBy;
				// If needed, look in the custom props obj for the comparison
				if (orderBy in this.prop) customNS = this.NS;
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
				if (itemId.indexOf(this.prop.id)===0) {
					removeFromStore(this, itemId);
					++count;
				}
			}
			return count;
		};
				
		function saveToStore(store, id, obj) {
			//global.console.debug('%s::%s::%s,  STORING obj with id [%s]', moduleName, ns, store.clazzName, id);
			store.Storage.setItem(id, JSON.stringify(obj));
		}
		function retrieveFromStore(store, id) {
			//global.console.debug('%s::%s::%s,  RETRIEVING obj with id [%s]', moduleName, ns, store.clazzName, id);
			return JSON.parse(store.Storage.getItem(id));
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
			*	Parameters:
			*		clazz 	- constructor function of the objects handled by the store
			*		options - optional hash of options:
			*			"prefix" 	- string, defaults to the classname, lowercased
			*			"session"	- boolean, defaults to false. Says if sessionStorage should be used
			*/
			create: function (clazz, options) {
				return new Store(clazz, options);
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