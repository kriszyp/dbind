dbind is a data binding package for Dojo that provides straightforward binding of data to
components like form inputs, validation connectors, and more. The dbind framework 
is designed to help you create organized, well-structured, layered applications, facilitating
a clean separation between a data model with validation logic and presentation elements.
It is also intended to be compatible with bindr, giving you the full capabilities of the
bindr reactive data binding language with Dojo and Dijit widgets. 

# Getting Started

The foundational module of dbind is `dbind/bind`, which returns a function that gives you
bindable objects. Usage is very simple, call bind with a target component and than indicate what
object or property you want to bind to:

	require(['dbind/bind'], function(bind){
		bind(anInputElement).to(myObject, "propertyName");
	});

And just like that we have a two-binding. The value from the object will be provided to the
input. Any changes to the input will cause the object to be modified. We could even
bind another element to this property to easily see the binding in action.

	bind(myDiv).to(myObject, 'propertyName');

And the value of the property would be put in the div, and updated anytime the input
was changed.

We can also create a property binding that can encapsulate a single property, and 
be directly bound to components:

	var myProperty = bind(myObject, 'propertyName');
	// now we can bind components to this property
	bind(anInputElement).to(myProperty);

## Dijit Components

With our bindings, we can easily use direct DOM elements or Dijit components interchangeably.
For example, we could bind a Dijit TextBox to myProperty as well:

	require(['dijit/form/TextBox', 'dbind/bind'], function(TextBox){
		var textBox = new TextBox({}, 'textbox');
		bind(textBox, myProperty);

# Validation

With dbind, we can do more than bind data to elements, we can also bind simple
data objects to validation layers to compose more sophisticated data models, that can
then be bound to UI elements. To bind to a validator, first we create a validator, giving
it a validation definition (based on JSON Schema), and then we bind it to a property or
object: 

	var myProperty = bind(new Validator({type:"number", maximum: 20, minimum: 10})).
		to(myObject, 'propertyName');  

And now when a user enters a value that is not a number or doesn't fall in the given
range it will be rejected.

The validator also gives us access to the error message so the UI can properly display
information to the user on why the input is invalid:

	bind(errorMessageElement).to(myProperty, 'error');

Any time an error occurs in validation, the `errorMessageElement` will automatically
be updated with error message. This makes it easy to build coherent, manageable 
validated forms. The validation layer is distinct from the UI layer, and they can easily 
be wired together for responsive validated forms and UIs.

# Composition of Binding-Driven Components

TODO