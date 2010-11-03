(function () {

function getFunctionName(f) {
	var match = (''+f).match(/function \s*([\w\$]*)\s*\(/);
	if (match) {return match[1];}
}
// Model
function Apa(name, age) {
	this.name = name;
	this.age = age;
}
Apa.prototype.toString = function () {
	return 'En apa som heter '+this.name+' med åldern '+this.age+'.';
};

// setup of factory, removing items with this test-factory's prefix
var factoryName = 'qUnit-test';
var Factory = SHFacFac(window, factoryName);
var factoryPrefix = Factory.getPrefix();
for (var item in localStorage) {
	if (item.indexOf(factoryPrefix)===0) {
		localStorage.removeItem(item);
	}
}

module('Factory');
/*****************************************************
* Sanity check of a created factory
******************************************************/
test('Factory creation', function () {	
	equal(typeof Factory.createStore, 'function', 'Factory has a function "createStore"');
	equal(typeof Factory.getName, 'function', 'Factory has a function "getName"');
	equal(Factory.getName(), factoryName, 'Name of factory works as expected');
});


module('Store');
var Apor = Factory.createStore(Apa);
/*****************************************************
* Sanity check of the API of a created store
******************************************************/
test('Store API', function () {

	var propTypes = {
		store: 'function'
		, retrieve: 'function'
		, remove: 'function'
		, list: 'function'
		, count: 'function'
		, clear: 'function'
		, info: 'function'
		, _internal: 'object'
	}, item, actualType, expectedType;
	
	for (item in Apor) {
		actualType = typeof Apor[item];
		expectedType = propTypes[item];
		if (typeof expectedType=='undefined') {
			ok(false, 'Unknown property "'+item+'" (type '+actualType+'), remove or update tests!');
		}
		else {
			equal(actualType, expectedType, 'Prop "'+item+'" is of expected type: '+propTypes[item]);
		}
	}
});


/*****************************************************
* Sanity check of the internal props of a created store
******************************************************/
test('Store, internal props', function() {
	var internal = Apor._internal, internalPropTypes = {
		clazz: 'function'
		, clazzName: 'string'
		, Storage: 'object'
		, NS: 'string'
		, PREFIX: 'string'
		, prop: 'object'
	}, item, actualType, expectedType;
	
	for (item in internal) {
		actualType = typeof internal[item];
		expectedType = internalPropTypes[item];
		if (typeof expectedType=='undefined') {
			ok(false, 'Unknown property "'+item+'" (type '+actualType+'), remove or update tests!');
		}
		else {
			equal(actualType, expectedType, 'Internal prop "'+item+'" is of expected type: '+internalPropTypes[item]);
		}
	}
});

/*****************************************************
* Store basic functionality
******************************************************/
test('Store functionality', function () {
	equal(Apor.count(), 0, 'Store is initially empty');
	var ola = new Apa('Ola', 28);
	var olaId = Apor.store(ola);
	equal(typeof olaId, 'string', 'Storing an object returns a string id');
	equal(Apor.count(), 1, 'After storing one object in an empty store, count is 1');
	var ola2 = Apor.retrieve(olaId);
	ok(ola2!==null && typeof ola2=='object', 'Retrieved a defined object');
	equal(getFunctionName(ola2.constructor), getFunctionName(Apa), 'Retrieved object was of correct instance type');
});

})();
