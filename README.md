dbind is a functional reactive data binding package that provides straightforward binding of data to
components like form inputs, validation connectors, and more. The dbind framework 
is designed to help you create organized, well-structured, layered applications, facilitating
a clean separation between a data model with validation logic and presentation elements.
It is also intended to be compatible with Dojo and bindr, giving you the full capabilities of the
bindr reactive data binding language with Dojo and Dijit widgets. 

Note that not all of the features described here are implemented and/or tested, this
is a work in progress.

# Getting Started

The foundational module of dbind is `dbind/bind`, which returns a function that gives you
bindable objects. Usage is very simple, call bind with a target component and than indicate what
object or property you want to bind to:

```javascript
require(['dbind/bind'], function(bind){
	bind(anInputElement).to(myObject, "propertyName");
});
```

And just like that we have a two-way binding. The value from the object's property will be provided to the
input. Any changes to the input will cause the object's property to be modified. We could even
bind another element to this property to easily see the binding in action.

```javascript
bind(myDiv).to(myObject, 'propertyName');
```

And the value of the property would be put in the div, and updated any time the input
was changed.

We can also create a property binding that can encapsulate a single property, and 
be directly bound to components:

```javascript
var myProperty = bind(myObject, 'propertyName');
// now we can bind components to this property
bind(anInputElement).to(myProperty);
```

We can bind object properties to inputs, where the property value is synchronized with
the input's value, and container elements like divs, where the property value is outputted
to the element's inner text.

In addition we can also bind an object to a form. In this case, dbind will search through
the form inputs and bind each one to the object's properties based on the input's `name` attribute.
If you have a form that you wish to create with HTML, this makes it very easy to bind an object to it 
without directly referencing each input: 

```javascript
bind(myForm).to(myObject);
```

## Dijit Components

Support for Dijit components is provided via `dbind/dijit` module.
With our bindings, we can easily use direct DOM elements or Dijit components interchangeably.
For example, we could bind a Dijit TextBox to myProperty as well:

```javascript
require(['dijit/form/TextBox', 'dbind/bind', 'dbind/dijit'], function(TextBox){
	var textBox = new TextBox({}, 'textbox');
	bind(textBox).to(myProperty);
});
```

## Transformations

We can also bind to functions to create a transformation for our binding. The function
will be called with a value to convert, allowing us to continuously apply transformation
to a source object. For example, we could create a functional transformation:

```javascript
function double(x){
	return x * 2;
}
var doubledValue = bind(double).to(sourceValue);
```

Now doubledValue will contain the value equal to twice the value of sourceValue. This
will remain true even as sourceValue varies in the future, `doubleValue` will continually
stay in sync.

We can also bind a transformation function to multiple source objects:

```javascript
function multiply(x, y){
	return x * y;
}
var productValue = bind(multiply).to([sourceValueA, sourceValueB]);
```

# Validation

With dbind, we can do more than bind data to elements, we can also bind simple
data objects to validation layers to compose more sophisticated data models, that can
then be bound to UI elements. To bind to a validator, first we create a validator, giving
it a validation definition (based on JSON Schema), and then we bind it to a property or
object: 

```javascript
require(['dbind/bind', 'dbind/Validator'], function(bind, Validator){
	// create a validator and bind it to a property of myObject 
	var myProperty = bind(new Validator({type:"number", maximum: 20, minimum: 10})).
		to(myObject, 'propertyName');
	// now we can bind the validated property to an element
	bind(anInputElement).to(myProperty);
});
```

And now when a user enters a value that is not a number or doesn't fall in the given
range it will be rejected.

The validator also gives us access to the error message so the UI can properly display
information to the user on why the input is invalid:

```javascript
bind(errorMessageElement).to(myProperty, 'error');
```

Any time an error occurs in validation, the `errorMessageElement` will automatically
be updated with error message. This makes it easy to build coherent, manageable 
validated forms. The validation layer is distinct from the UI layer, and they can easily 
be wired together for responsive validated forms and UIs.

# Element properties/attributes

With dbind, property in element can be bound in the following way:

```javascript
bind(anElement, "innerHTML").to(myProperty);
```

There are some special properties under bindable object for element:

* `[attributeName]` is mapped to the element's attributeName attribute's value
* `.className` is mapped to the state whether className is applied or not to the element
* `.collapsed` is mapped to the state whether the element has `display:none` style or not
* `.hidden` is mapped to the state whether the element has `visibility:hidden` style or not

# Repeating UI

By importing `dbind/foreach` module, you can create repeating UI from array:

```javascript
require(['dbind/bind', 'dbind/foreach'], function(bind){
	var a = ['foo', 'bar'];
	bind(anElement).use("createChild", function(entry){
		var element = document.createElement("div");
		element.innerText = entry;
		return element;
	}).foreach(a);
});
```

If the array implements `watchElements(idx, removals, adds)` interface upon removals/adds of array
elements (splice), the UI created in above way responds to such removals/adds.

# Declarative binding

If a `<div>` has `<input>`s like below,
`bind(theDiv).use("container").to({finished: true, title: "Foo"})` checks off the checkbox and sets
"Foo" to the textbox:

```html
<div>
	<input name="finished" type="checkbox">
	<input name="title" type="text">
</div>
```

By importing `dbind/parse` module, `data-mvc-bindings` custom attribute can be used.
`bind(theDiv).use("container").to({finished: true, title: "Foo"})` puts "true" and "Foo" to the
below markup:

```html
<div>
	<span data-mvc-bindings="finished"></span>
	<span data-mvc-bindings="title"></span>
</div>
```

Same thing happens with the following HTML, too:

```html
<div>
	<span data-mvc-bindings="innerText: finished"></span>
	<span data-mvc-bindings="innerText: title"></span>
</div>
```

`bind(theDiv).use("container").to({finished: true, title: "Foo"})` hides the `<span>` in the below
markup:

```html
<div>
	<span data-mvc-bindings="innerText: title, '.collapsed': finished"></span>
</div>
```

Property in `data-mvc-bindings` beginning with "on" sets an event handler. For example, 
`bind(theDiv).use("container").to({handleClick: function(){ alert("Hello"); }})` sets the
`handleClick` property as the button's click handler in the following HTML:

```html
<div>
	<input type="button" value="Hello" data-mvc-bindings="onclick: handleClick">
</div>
```

By importing `dbind/dijit` module in addition to `dbind/parse` module, `data-mvc-binding-type`
attribute can be used so that `bind(theDiv).use("container").to({title: "Foo"})` creates a Button
widget with "Foo" as its label for below HTML:

```html
<div>
	<span data-mvc-binding-type="dijit/form/Button" data-mvc-bindings="label: title"></span>
</div>
```

By importing `dbind/foreach` module in addition to `dbind/parse` module,
`bind(theOuterMostDiv).use("container").to({collection: array})`
where `array` is `[{finished: true, title: "Foo"}, {finished: false, title: "Bar"}]`
creates two sets of checkbox/textbox combination for the following HTML:

```html
<div>
	<div data-mvc-bindings="foreach: collection">
		<script type="dbind/InlineTemplate">
			<div>
				<input name="finished" type="checkbox">
				<input name="title" type="text">
			</div>
		</script>
	</div>
</div>
```

# Snapshot

By importing `dbind/Snapshot` module, `bind(something).use("keepSnapshot")` makes the bindable
object start keeping its snapshot. A snapshot is another kind of bindable object that keeps the
value of upstream source (which in this case is, the bindable object the snapshot is created
with) of the time snapshot is created. A snapshot won't be updated (even if there are changes in
value of upstream source) until application requests that the snapshot should be in sync with its
upstream source, by calling the snapshot's `pull()` method (or upstream source's `push()` method).

Snapshot will be useful for creating UI with a feature to revert to its earlier data, or checking
if there is a change in a bindable object since a point in time (by calling its `dirty()` method).

# dbind interfaces

Bindable objects implement a set of interfaces called *Observable*. Observable holds a single
value, and allows components to react to change in its value via `then()` interface. The callback
provided to `then()` will be called with the current value of the source object, and called again
each time it changes in the future. In other words, `then()` interface makes Observable very
similar to Deferred, but it has the following key differences:

* `resolve()` can be called multiple times, and listener callbacks are called every time that happens

* Allows to remove indivisual callback set, by calling `cancel()` of what `then()` returns
(This helps lifecycle management of the cosuming component, as Observable instances may persist
throughout the entire application lifecycle)

* Read-only view is not (explicitly) provided from Observable, though `resolve()`, `reject()` and
`then()` returns read-only view

* No progress callback support

In addition to what Observable provides, dbind relies on several interfaces for connecting
components. You can interact with these objects using the following API, or you can create your own
implementations of the APIs. The `bind()` function returns bindable objects. Bindable objects have
the follow method:  

* `to(source, property?)` - This binds this object to the provided source object. Any changes in the
source object will be propagated to the bindable target object.  If a property argument
is provided, the target object will be bound to the property of the source object. We speak 
of changes coming
from the source object as traveling *up* to the target. The target component may be
UI component that can support editing, sending requested changes from the user *down*
to the source.
This should clean up the binding to the source object that was done earlier.

* `is(value)` - This is called to change the value of the target object from a downstream
source.

* `put(value)` - This is called to change the value of the source object from an upstream
target component. This may be rejected.
This method may be omitted if the source object can't be modified by upstream components.

Source objects may also be mappable; they can have properties. This is provided through
the following methods:

* `get(property)` - Returns a reactive object for the given property.

* `get(property, callback)` - Shorthand for `get(property).then(callback)`.

* `set(property, child)` - Sets a reactive object (`child`) for the given property.

* `set(property, child, callback)` - Shorthand for `set(property, child).then(callback)`.

Bindable object can have several options that affect its behavior. This is provided through the
following methods:

* `canuse(option)` - Returns whether this object has the given option.

* `use(option, value, option, value, ...)` - Provides option values to this object.

* `using(option)` - Returns value of the given option.

Some bindable objects may have shorter lifecycle than others. The following methods can be used to
make sure bindable object that has finished its lifecycle no longer affects other bindable objects:

* `destroy()` - Marks this object as it finished its lifecycle, and cleans up the binding to the
source object as well as its child bindable objects.

* `reset()` - An internal method, typically called from `to()`, that cleans up the (earlier) binding to
the source object, as well as the child objects' (earlier) binding to the children of source object
(if they were bound by the same `to()` call).

* `own(handle, handle, ...)` - An internal method to let `destroy()` method call the cleanup method of
the given handles.

* `resettable(handle, handle, ...)` - An internal method to let `reset()` method call the cleanup
method of the given handles.

Bindable objects have the following other internal methods:

* `keys(callback)` - Sends child bindable objects via the given callback function. It can delegate
generating the list of keys to upstream source (if exists). The callback function has `(key,
child)` interface.

* `getValue(callback)` - Works as a "getter". Sends the current value via the given callback
function.

* `setValue(value, callback?)` - Works as a "setter". Sets given new value. It can cancel setting
the new value, for cases like there is no change in value. If a callback function is given and the
new value is set, the given callback function is called.

* `enumerate()` - Enumerates child bindables and maps them to the child bindables of upstream source.

# Composition of Binding-Driven Components

TODO

