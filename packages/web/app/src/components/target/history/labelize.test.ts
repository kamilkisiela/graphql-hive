import { labelize } from './labelize';

describe('labelize', () => {
  it('should work', () => {
    expect(
      labelize(
        "Description for argument id on field 'User.email' changed from 'ID&apos;s of &quot;User&quot;' to 'ID&apos;s of &quot;Hello&quot;'",
      ),
    ).toMatchInlineSnapshot(`
      [
        Description for argument id on field ,
        <Label>
          User.email
        </Label>,
         changed from ,
        <Label>
          ID's of "User"
        </Label>,
         to ,
        <Label>
          ID's of "Hello"
        </Label>,
        ,
      ]
    `);
  });
});
